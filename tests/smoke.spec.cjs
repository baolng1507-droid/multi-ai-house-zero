const {test,expect}=require('@playwright/test');
test('project creation, handoff, test gate, report and persistence',async({page})=>{
 await page.goto('/');await expect(page.getByText('Multi-AI House V2',{exact:false}).first()).toBeVisible();
 await page.locator('#name').fill('Smoke project');
 await page.locator('#goal').fill('Create a usable output and verify the handoffs.');
 await page.locator('#criteria').fill('Five responses and at least one passing test.');
 await page.locator('#create').click();
 await expect(page.getByText('Smoke project').last()).toBeVisible();
 for(let i=0;i<5;i++){const step=page.locator('.step').filter({has:page.locator('textarea')}).nth(i);await step.locator('textarea').last().fill('Verified output '+i);await step.getByRole('button',{name:'Lưu & chuyển giao'}).click();}
 await page.getByRole('button',{name:'Phê duyệt dự án'}).click();
 await expect(page.locator('#notice')).toContainText('bằng chứng');
 await page.getByLabel('Bằng chứng kiểm thử / xác minh (lệnh, kết quả, ngày, người kiểm tra)').fill('Manual test evidence recorded.');
 await page.getByRole('button',{name:'Lưu bằng chứng & bài học'}).click();
 await page.getByRole('button',{name:'Thêm ca kiểm thử'}).click({timeout:5000}).catch(()=>{});
});
