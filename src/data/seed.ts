export type FeedPost = { id: string; name: string; handle: string; time: string; text: string; tag: string; likes: number; comments: number; avatar: string; art?: string; liked?: boolean };
export type Product = { id: string; name: string; price: number; seller: string; category: string; color: string; icon: string };
export const initialPosts: FeedPost[] = [
 {id:'p1',name:'Ama Serwaa',handle:'amastudio',time:'18 min',text:'A little reminder from today’s studio: make room for the work that feels like you. New print collection is up ✨',tag:'CREATOR',likes:128,comments:18,avatar:'AS',art:'art-peach'},
 {id:'p2',name:'Kojo Mensah',handle:'kojo.builds',time:'1 hr',text:'We tested our community garden’s first sensor kit this morning. 14 growers, one very muddy notebook, and a lot to learn.',tag:'COMMUNITY',likes:76,comments:9,avatar:'KM',art:'art-leaf'},
 {id:'p3',name:'Nana K.',handle:'nanaplays',time:'3 hr',text:'Anyone up for a quick round tonight? New weekly challenge is live. Best of three, friendly rules.',tag:'GAMING',likes:52,comments:12,avatar:'NK'}
];
export const products: Product[] = [
 {id:'x1',name:'Coastline print set',price:85,seller:'Ama Studio',category:'Art & design',color:'product-peach',icon:'◒'},
 {id:'x2',name:'Everyday carry tote',price:120,seller:'Common Ground',category:'Accessories',color:'product-sage',icon:'▱'},
 {id:'x3',name:'Field notes · Vol. 01',price:45,seller:'Small Hours Press',category:'Books & paper',color:'product-blue',icon:'▤'},
 {id:'x4',name:'Hand-thrown cup',price:160,seller:'Kasa Works',category:'Home',color:'product-lilac',icon:'◡'}
];
export const opportunities = [
 {id:'o1',type:'CREATOR GRANT',title:'Create Forward micro-grant',org:'Open Frame Collective',place:'Accra · Hybrid',due:'Closes 18 Oct',tone:'lime'},
 {id:'o2',type:'FREELANCE',title:'Illustrator for a learning series',org:'Bright Path Studio',place:'Remote · Ghana',due:'Closes 04 Oct',tone:'peach'},
 {id:'o3',type:'COMMUNITY',title:'Coastline cleanup day',org:'Blue Ground Network',place:'Cape Coast · In person',due:'Saturday, 9:00 AM',tone:'blue'}
];
export const fmt = (n:number) => `GH₵${n.toFixed(2)}`;
