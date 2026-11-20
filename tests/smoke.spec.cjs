const {test,expect}=require('@playwright/test');
test('real browser: create, handoff, fail-closed gate, approval, reload and export',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.brand')).toContainText('Multi-AI House V2');
 await page.locator('#name').fill('Smoke project');
 await page.locator('#goal').fill('Create a usable output and verify the handoffs.');
 await page.locator('#criteria').fill('Five responses and at least one passing test.');
 await page.locator('#create').click();
 await expect(page.locator('article.project h2')).toHaveText('Smoke project');
 for(let i=0;i<5;i++){
  const step=page.locator('section.step').nth(i);
  await step.locator('textarea').last().fill('Verified output '+i);
  await step.getByRole('button',{name:'Lưu & chuyển giao'}).click();
 }
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.locator('#notice')).toContainText('bằng chứng');
 await page.locator('textarea').filter({hasText:''}).count();
 const section=page.locator('section.panel').filter({hasText:'ECC-inspired'});
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
 await expect(page.locator('article.project h2')).toHaveText('Smoke project');
 await expect(page.getByText('Đã phê duyệt',{exact:false}).first()).toBeVisible();
 await expect(page.locator('section.step.done')).toHaveCount(5);
 expect(errors).toEqual([]);
});
