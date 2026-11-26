import {fireEvent,render,screen,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {ReviewDecision} from './ReviewDecision';
afterEach(cleanup);
describe('explicit publication review',()=>{
 it('requires a decision, reason and separate self-review acknowledgement',()=>{
  const submit=vi.fn();render(<ReviewDecision revision={3} contentHash={'a'.repeat(64)} selfReview authorized eligible onSubmit={submit}/>);
  const button=screen.getByRole('button',{name:'Record review decision'}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'approved'}});
  fireEvent.change(screen.getByLabelText('Reason for this decision'),{target:{value:'Reviewed the actual ordinary listing.'}});
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(button.disabled).toBe(false);fireEvent.click(button);
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({revision:3,contentHash:'a'.repeat(64),decision:'approved',selfReviewConfirmed:true,reason:'Reviewed the actual ordinary listing.'}));
  expect(screen.getByText(/not independent third-party verification/)).toBeTruthy();
 });
 it('never enables restricted-category approval or an unauthorized exception',()=>{
  const submit=vi.fn();const r=render(<ReviewDecision revision={1} contentHash={'a'.repeat(64)} selfReview authorized eligible={false} onSubmit={submit}/>);
  fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'approved'}});
  fireEvent.change(screen.getByLabelText('Reason for this decision'),{target:{value:'Reason cannot bypass safety controls.'}});
  fireEvent.click(screen.getByRole('checkbox'));
  expect((screen.getByRole('button',{name:'Record review decision'}) as HTMLButtonElement).disabled).toBe(true);
  r.rerender(<ReviewDecision revision={1} contentHash={'a'.repeat(64)} selfReview authorized={false} eligible onSubmit={submit}/>);
  expect((screen.getByRole('button',{name:'Record review decision'}) as HTMLButtonElement).disabled).toBe(true);
  expect(submit).not.toHaveBeenCalled();
 });
});
