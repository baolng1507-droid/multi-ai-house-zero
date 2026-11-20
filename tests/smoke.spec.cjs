const {test,expect}=require('@playwright/test');
test('real browser: create, handoff, fail-closed gate, approval, reload and export',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.brand')).toContainText('Multi-AI House V2');
 await page.locator('#name').fill('Smoke project');
 await page.locator('#goal').fill('Create a usable output and verify the handoffs.');
 await page.locator('#criteria').fill('Five responses and at least one passing test.');
 await page.locator('#create').click();
 await expect(page.getByRole('heading',{name:'Smoke project',exact:true})).toHaveText('Smoke project');
 for(let i=0;i<5;i++){
  const step=page.locator('section.step').nth(i);
  await step.locator('textarea').last().fill('Verified output '+i);
  await step.getByRole('button',{name:'Lưu & chuyển giao'}).click();
 }
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.locator('#notice')).toContainText('bằng chứng');
 const section=page.locator('section.panel').filter({hasText:'ECC-inspired'}).last();
 await section.locator('textarea').first().fill('Test performed on Chromium, observed successful result.');
 await section.getByRole('button',{name:'Lưu bằng chứng & bài học'}).click();
 let replies=['Open homepage','Page loads'];
 page.on('dialog',async dialog=>{await dialog.accept(replies.shift()||'');});
 await page.getByRole('button',{name:'Thêm ca kiểm thử'}).click();
 await expect(page.getByText('Ca 1: Open homepage')).toBeVisible();
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.locator('#notice')).toContainText('PASS');
 replies=['Open homepage','Page loads','Loaded successfully','PASS'];
 await page.getByRole('button',{name:'Sửa',exact:true}).click();
 await expect(page.getByText('Trạng thái: PASS')).toBeVisible();
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.getByText('Đã phê duyệt',{exact:false}).first()).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Smoke project',exact:true})).toHaveText('Smoke project');
 await expect(page.getByText('Đã phê duyệt',{exact:false}).first()).toBeVisible();
 await expect(page.locator('section.step.done')).toHaveCount(5);
 expect(errors).toEqual([]);
});

test('restoring backup never trusts stale approval or PASS claims',async({page})=>{
 await page.goto('/');
 page.on('dialog',dialog=>dialog.accept());
 const project={id:'import-test',name:'Restored project',goal:'Verify imported approval state',criteria:'Fresh verification required',approved:true,evidence:'Unverified old device',steps:['ChatGPT','Gemini','DeepSeek','Claude','Grok'].map(agent=>({agent,result:'Old answer'})),tests:[{name:'Old test',expected:'PASS',actual:'Claimed pass',status:'PASS'}]};
 await page.locator('#import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'Multi-AI House V2',version:2,projects:[project]}))});
 await expect(page.locator('article.project')).toContainText('Chưa phê duyệt');
 await expect(page.locator('article.project')).toContainText('Trạng thái: NOT_RUN');
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.locator('#notice')).toContainText('bằng chứng');
});

test('new request clears stale delivery even when provider rejects it',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('multi-ai-house-auto-v1',JSON.stringify({brief:'Old brief',draft:'Old draft',final:'Old final'})));
 await page.reload();
 await expect(page.locator('#final')).toContainText('Old final');
 await page.route('https://openrouter.ai/api/v1/chat/completions',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{message:'rate limited'}})}));
 await page.locator('#brief').fill('New brief');
 await page.locator('#key').fill('test-key');
 await page.locator('#start').click();
 await expect(page.locator('#status')).toContainText('giới hạn lượt gọi');
 await expect(page.locator('#results')).toBeHidden();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('multi-ai-house-auto-v1')));
 expect(stored).toEqual({brief:'New brief',draft:'',final:''});
});


test('two real browser handoffs with mocked provider and retry after reviewer rate limit',async({page})=>{
 await page.goto('/');
 const requests=[];
 let reviewAttempts=0;
 await page.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
  const payload=route.request().postDataJSON();
  requests.push(payload);
  if(requests.length===1){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Draft from writer'}}]})});
  }else if(++reviewAttempts===1){
   await route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{message:'rate limited'}})});
  }else{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Reviewed final answer'}}]})});
  }
 });
 await page.locator('#brief').fill('Write a short, useful answer');
 await page.locator('#key').fill('test-key');
 await page.locator('#start').click();
 await expect(page.locator('#status')).toContainText('giới hạn lượt gọi');
 await expect(page.locator('#draft')).toContainText('Draft from writer');
 await expect(page.locator('#final')).toBeHidden();
 await page.reload();
 await expect(page.locator('#retry')).toBeVisible();
 await page.locator('#key').fill('test-key');
 await page.locator('#retry').click();
 await expect(page.locator('#final')).toContainText('Reviewed final answer');
 expect(requests).toHaveLength(3);
 expect(requests[0].model).toContain('gemma');
 expect(requests[1].model).toContain('nemotron');
 expect(requests[2].messages[1].content).toContain('Draft from writer');
 expect(requests.every(r=>r.provider?.max_price?.prompt===0&&r.provider?.max_price?.completion===0)).toBe(true);
});
