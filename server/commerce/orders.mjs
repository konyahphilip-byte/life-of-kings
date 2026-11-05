// Shared existing order rules. Caller holds the transaction; no provider operation.
import {createHash} from 'node:crypto';
export function orderQuote(items){
 const lines=items.map(i=>[i.productId,i.variantId||null,i.quantity,i.unitPriceMinor]);
 lines.sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);
 return createHash('sha256').update(JSON.stringify(lines)).digest('hex');
}
export function createOrderWriter({q,all,run,assert,now,id,productVariants,notify,event,getOrder,visibleOrder,postgresMode}){
 return async function writeOrder(ctx,requestedByProduct,expectedTotal,expectedQuote){
      let total = 0;
      const lines = [];
      for (const [productId, requestedLines] of requestedByProduct) {
        const product = await q(
          `SELECT * FROM products WHERE id=? AND status='active'${postgresMode ? " FOR UPDATE" : ""}`,
          productId,
        );
        assert(
          product,
          404,
          "product_unavailable",
          "A product is no longer available.",
        );
        assert(
          product.seller_id !== ctx.user.id,
          400,
          "own_product",
          "You cannot purchase your own listing.",
        );
        assert(
          product.fulfillment_type !== "external_checkout",
          400,
          "external_checkout",
          "This item uses external checkout.",
        );
        const variants = productVariants(product);
        const reservationQty = requestedLines.reduce((sum, line) => sum + line.qty, 0);
        assert(Number.isSafeInteger(reservationQty), 400, "invalid_quantity", "Requested quantity is too large.");
        assert(
          product.stock >= reservationQty,
          409,
          "stock_changed",
          `${product.name} does not have enough stock.`,
        );
        for (const requested of requestedLines) {
          let variant = null;
          if (variants.length) {
            assert(requested.variantId, 400, "variant_required", `Choose an option for ${product.name}.`);
            variant = variants.find((candidate) => candidate.id === requested.variantId);
            assert(variant, 400, "variant_unavailable", `That option for ${product.name} is no longer available.`);
            if (variant.stock !== null) {
              assert(variant.stock >= requested.qty, 409, "variant_stock_changed", `${product.name} · ${variant.title} does not have enough stock.`);
              variant.stock -= requested.qty;
            }
          } else {
            assert(!requested.variantId, 400, "variant_unavailable", `${product.name} does not have selectable options.`);
          }
          const unitPriceMinor = variant?.priceMinor || product.price_minor;
          const lineTotal = unitPriceMinor * requested.qty;
          assert(Number.isSafeInteger(lineTotal), 400, "invalid_total", "Order total is too large.");
          total += lineTotal;
          lines.push({ product, qty: requested.qty, variantId: variant?.id || null, variantTitle: variant?.title || null, unitPriceMinor });
        }
        const reserved = await run(
          "UPDATE products SET stock=stock-?,variants_json=?,updated_at=? WHERE id=? AND stock>=?",
          reservationQty,
          JSON.stringify(variants),
          now(),
          product.id,
          reservationQty,
        );
        assert(reserved.changes === 1, 409, "stock_changed", "Stock changed while your order was being placed.");
      }
      assert(
        total > 0 && total <= 2147483647 && Number.isSafeInteger(total),
        400,
        "invalid_total",
        "Order total is invalid.",
      );
      if (expectedTotal !== undefined) assert(total === expectedTotal,409,"cart_price_changed","Prices changed. Refresh and review your bag.");
      if (expectedQuote !== undefined) assert(orderQuote(lines.map(l=>({productId:l.product.id,variantId:l.variantId,quantity:l.qty,unitPriceMinor:l.unitPriceMinor})))===expectedQuote,409,'cart_price_changed','Item prices changed. Refresh and review your bag.');
      const orderId = id(),
        stamp = now();
      await run(
        "INSERT INTO orders(id,buyer_id,total_minor,created_at,updated_at) VALUES(?,?,?,?,?)",
        orderId,
        ctx.user.id,
        total,
        stamp,
        stamp,
      );
      const groups = new Map();
      for (const line of lines) {
        const sellerId = line.product.seller_id;
        if (!groups.has(sellerId)) {
          const groupId = id();
          groups.set(sellerId, groupId);
          await run(
            "INSERT INTO fulfillment_groups(id,order_id,seller_id,created_at,updated_at) VALUES(?,?,?,?,?)",
            groupId,
            orderId,
            sellerId,
            stamp,
            stamp,
          );
        }
        const groupId = groups.get(sellerId);
        await run(
          "INSERT INTO order_items(id,order_id,group_id,product_id,product_name,variant_id,variant_title,quantity,unit_price_minor,seller_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
          id(),
          orderId,
          groupId,
          line.product.id,
          line.product.name,
          line.variantId,
          line.variantTitle,
          line.qty,
          line.unitPriceMinor,
          sellerId,
        );
        await notify(
          sellerId,
          "order",
          "New EcoVibes order",
          `Order ${orderId.slice(0, 8)} includes ${line.qty} × ${line.product.name}.`,
          "order",
          orderId,
        );
      }
      await event(ctx.user.id, "order", orderId, "ORDER_CREATED", {
        totalMinor: total,
        groupCount: groups.size,
      });
      return visibleOrder(await getOrder(orderId), ctx);
 };
}
