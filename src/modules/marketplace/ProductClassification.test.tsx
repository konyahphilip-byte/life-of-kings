import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {useState} from 'react';
import {afterEach,describe,it,expect} from 'vitest';
import ProductClassification,{ProductDetails} from './ProductClassification';
afterEach(cleanup);
function Form(){const [id,setId]=useState(''),[attrs,setAttrs]=useState<Record<string,string|number>>({});return <><ProductClassification productType="physical" categoryId={id} attributes={attrs} onChange={(key,value)=>{setId(key);setAttrs(value);}}/><output>{JSON.stringify(attrs)}</output></>;}
describe('useful category-specific product details',()=>{
 it('requests only relevant details and drops old fields on category change',()=>{render(<Form/>);fireEvent.change(screen.getByLabelText('Category'),{target:{value:'electronics.phones'}});fireEvent.change(screen.getByLabelText('Condition'),{target:{value:'used'}});fireEvent.change(screen.getByLabelText('Storage · GB (optional)'),{target:{value:'128'}});expect(screen.getByRole('status').textContent).toContain('128');fireEvent.change(screen.getByLabelText('Category'),{target:{value:'food.produce'}});expect(screen.queryByLabelText('Storage · GB (optional)')).toBeNull();expect(screen.getByRole('status').textContent).toBe('{}');expect(screen.getByLabelText('Price is per')).toBeTruthy();});
 it('shows saved seller declarations without a verification claim or private fields',()=>{render(<ProductDetails item={{categoryId:'electronics.phones',categoryVersion:1,attributes:{condition:'used',storageGb:128}}}/>);expect(screen.getByText('Seller-entered details')).toBeTruthy();expect(screen.getByText('128')).toBeTruthy();expect(screen.getByText('used')).toBeTruthy();});
 it('never invents structured details for a legacy or malformed listing',()=>{const view=render(<ProductDetails item={{}}/>);expect(view.container.textContent).toBe('');view.rerender(<ProductDetails item={{categoryId:'electronics.phones',categoryVersion:1,attributes:{condition:'verified'}}}/>);expect(view.container.textContent).toBe('');});
});
