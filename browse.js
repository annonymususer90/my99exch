const { defaultPassword } = require('./constant');
const { infoAsync, errorAsync } = require('./apputils');

async function login(page, url, username, password) {
    await page.goto(url, { timeout: 90000 });
    await page.waitForXPath('/html/body/div[1]/div/div/div[2]/div/form/div[1]/input')
        .then(
            await page.type('#username', username),
            await page.type('#password', password)
        );


    await page.evaluate(`document.querySelector('label[for="remember_me"]').click();`);
    await page.click('#login-form > div:nth-child(5) > button');
    await page.waitForNavigation({ timeout: 90000 });
    infoAsync(`login successful, url: ${url}`);
    return;
}

async function register(page, url, username) {
    try {
        await page.goto(`${url}`, { timeout: 120000 });
        await page.waitForSelector('body');
        await page.waitForSelector('body > header > nav > div > ul > li:nth-child(6) > a')
            .then(element => element.click());

        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[1]/input', { timeout: 120000 })
            .then(element => element.type(username))
            .catch(err => console.log(err));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[2]/input', { timeout: 120000 })
            .then(element => element.type(username));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[3]/input', { timeout: 120000 })
            .then(element => element.type(defaultPassword));
        await page.waitForXPath('/html/body/main/div/div/div/div/div/div/div/form/div[4]/label', { timeout: 120000 })
            .then(element => element.type(defaultPassword + '\n'));
        // await page.waitForNavigation('body > main > div > div > div > div > div > div > div > form > div:nth-child(12) > input', { timeout: 120000 })
        //     .then(ele => ele.click());

        await page.waitForNavigation({ timeout: 1000 })
            .catch(async err => {
                let url = await page.url();
                if (url !== null && url !== `${url}/activeusers`) {
                    throw new Exception("invalid username");
                }
            });

        return { success: true }

    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: "invalid username" };
    }
}

async function changePass(page, url, username, pass) {
    try {
        await page.goto(`${url}/users`, { timeout: 120000 });
        await page.waitForSelector('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input', { timeout: 120000 });
        const searchInput = await page.$('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input');
        await searchInput.type(username + '\n');
        await page.waitForSelector(`span[title='${username}']`, { timeout: 3000 }).catch(() => {
            throw new Error("invalid username");
        });

        let js = `document.querySelector('span[title="${username}"]').parentElement.parentElement.children[6].firstChild.children[2].click();`;
        let res = await page.evaluate(js);
        res = await page.evaluate(`document.querySelector('ul[role="tablist"]').children[1].firstChild.click();`);

        await page.waitForSelector('input[name="userchangepasswordpassword"]', { timeout: 120000 })
            .then(element => element.type(pass));
        await page.waitForSelector('input[name="userchangepasswordcpassword"]', { timeout: 120000 })
            .then(element => element.type(pass));
        await page.waitForSelector('input[name="userchangepasswordmpassword"]', { timeout: 120000 })
            .then(element => element.type("244092\n"));
    } catch (error) {
        errorAsync(error.message);
        return { success: false, error: error.message };
    }
}

async function lockUser(page, url, username, tCode) {
    try {
        await page.goto(`${url}`, { timeout: 120000 });
        await page.waitForSelector('body > header > nav > div > ul.right.hide-on-med-and-down > li:nth-child(6) > a', { timeout: 120000 })
            .then(
                await page.click('body > header > nav > div > ul.right.hide-on-med-and-down > li:nth-child(6) > a', { timeout: 120000 })
            );
        await page.waitForSelector('#listUser > li:nth-child(1) > a', { timeout: 120000 })
            .then(
                await page.click('#listUser > li:nth-child(1) > a', { timeout: 120000 })
            );
        await page.waitForNavigation({ timeout: 120000 });
        await page.waitForSelector('#search-user', { timeout: 120000 });
        await page.waitForSelector('#search-user')
            .then(element => element.type(username + "\n"));
        await page.evaluate(`document.querySelector('tbody').children[0].children[0].children[1].innerText === ${username}`, { timeout: 6000 })
            .catch(() => {
                throw new Error("invalid username");
            });
        await page.evaluate(`document.querySelector('span[title="${username}"]').parentElement.parentElement.children[6].firstChild.children[2].click()`);
        await page.evaluate(`document.querySelector('ul[role="tablist"]').children[2].firstChild.click()`);
        // await page.evaluate(`document.querySelector('form[data-vv-scope="UserLock"]').firstChild.children[1].firstChild.click()`);
        // await page.evaluate(`document.querySelector('form[data-vv-scope="UserLock"]').children[1].children[1].firstChild.click()`);
        await page.waitForSelector('input[name="UserLockMpassword"]')
            .then(async element => await element.type(tCode + "\n"));

    } catch (error) {
        await login();
        return { success: false, error: error.message };
    }
}


async function deposit(page, url, username, amount, tCode) {
    try {
        await page.goto(`${url}/users`, { timeout: 120000 });
        await page.waitForSelector('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input', { timeout: 120000 });
        await page.waitForSelector('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input')
            .then(element => element.type(username + "\n"));
        await page.waitForSelector(`span[title='${username}']`, { timeout: 3000 }).catch(() => {
            throw new Error("invalid username");
        });
        await page.evaluate(`document.querySelector('span[title="${username}"').parentElement.parentElement.children[1].children[0].click();`);
        await page.evaluate(`document.querySelector('ul[role="tablist"]').children[0].firstChild.click();`);
        const element = await page.waitForSelector('input[name="userCreditUpdateamount"]', { timeout: 120000 });
        await element.type(amount);
        await page.evaluate((amount) => {
            const element = document.querySelector('input[name="userCreditUpdateamount"]');
            if (element && element.value !== amount) {
                element.value = amount;
            }
        }, amount);
        await page.waitForSelector('input[name="userCreditUpdatempassword"]', { timeout: 30000 })
            .then(element => element.type(tCode + "\n"));
        await page.waitForSelector('.swal2-container.swal2-top-end.swal2-backdrop-show', { timeout: 120000 });
        let msg = await page.evaluate(`document.querySelector('div[class="swal2-container swal2-top-end swal2-backdrop-show"]').children[0].children[1].firstChild.innerText;`);

        if (msg.includes("Your Client Does Not Have Sufficient Credit")) {
            return {
                success: false, message: msg
            };
        };
        return {
            success: true,
            message: msg
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function withdraw(page, url, username, amount, tCode) {
    try {
        await page.goto(url + '/users', { timeout: 120000 });
        await page.waitForSelector('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input', { timeout: 120000 });
        await page.waitForSelector('#layout-wrapper > div.main-content > div > div > div > div.row.account-list > div > div > div > div.row.row5 > div.col-md-6.mb-2.search-form > form > div.d-inline-block.form-group.form-group-feedback.form-group-feedback-right > input')
            .then(element => element.type(username + "\n"));
        await page.waitForSelector(`span[title='${username}']`, { timeout: 3000 }).catch(() => {
            throw new Error("invalid username");
        });
        await page.evaluate(`document.querySelector('span[title="${username}"').parentElement.parentElement.children[1].firstChild.click();`);
        await page.evaluate(`document.querySelector('ul[role="tablist"]').children[1].firstChild.click();`);
        const element = await page.waitForSelector('input[name="userWithdrawCreditUpdateamount"]', { timeout: 120000 });
        await element.type(amount);
        await page.evaluate((amount) => {
            const element = document.querySelector('input[name="userWithdrawCreditUpdateamount"]');
            if (element && element.value !== amount) {
                element.value = amount;
            }
        }, amount);
        await page.waitForSelector('input[name="userWithdrawCreditUpdatempassword"]', { timeout: 120000 })
            .then(element => element.type(tCode + "\n"));
        await page.waitForSelector('.swal2-container.swal2-top-end.swal2-backdrop-show', { timeout: 120000 });
        let msg = await page.evaluate(`document.querySelector('div[class="swal2-container swal2-top-end swal2-backdrop-show"]').children[0].children[1].firstChild.innerText;`);

        if (msg.includes("Your Client Does Not Have Sufficient Balance")) {
            return {
                success: false, message: msg
            };
        };
        return {
            success: true,
            message: msg
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    login: login,
    register: register,
    lockUser: lockUser,
    deposit: deposit,
    withdraw: withdraw,
    changePass: changePass
}