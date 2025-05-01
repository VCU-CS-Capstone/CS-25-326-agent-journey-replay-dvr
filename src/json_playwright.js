const fs = require('fs');
const { chromium } = require('playwright');
const sql = require('mssql')

//Default json path
let jsonDataPath = 'test.json';

// Azure SQL connection configuration
const config = {
  user: 'SuperUser1',
  password: '9$tZMuJMGty9fDE',
  server: 'delhubandreal.database.windows.net',
  database: 'CapitalOne Database',
  options: {
    encrypt: true, 
    trustServerCertificate: false 
  }
};

function setJsonDataPath(newPath) {
  jsonDataPath = newPath;
}

function playbackFile() {
  fs.readFile(jsonDataPath, 'utf-8', async (err, data) => {
    if (err) {
      console.error('Error reading JSON file:', err);
      return;
    }

    try {
      
      const events = JSON.parse(data);
      const APICalls = await GetAPIData(events[0]);
      let curAPICall = 0;

      // Start Playwright
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      //Go to webpage
      await page.goto('https://capitaloneagentdashboard.azurewebsites.net'); 

      //Skip log in
      console.log("Logging in as guest");
      await page.click(`#guestLogin`);
      await page.waitForTimeout(2000);

      // Variable to track the last clicked element ID
      let lastClickedElementId = null;

      // Iterate over events and perform actions
      for (const event of events) {
        console.log(`Processing event: ${event.event_name}`);

        //Mock API call
        await page.route(/.*\/user\?first_name=.*/, async (route, request) => {

          let firstName = "TESTING";
          APIdata = null;
          
          if (APICalls != null)
              {
              //console.log(APICalls.length)
              if (curAPICall < APICalls.length)
                  {
                  //console.log("test2")
                  APIdata = JSON.parse(APICalls[curAPICall].jsondata);
                  curAPICall++;
                  }
              }
          // Define the mocked response
          mockResponse = [
            { first_name: firstName, last_name:"TESTCASE", money: 1, credit: 1, gender: "Female"}
          ];

          if (APIdata != null)
              {
              mockResponse[0].credit = APIdata[0].credit;
              mockResponse[0].money = APIdata[0].money;
              mockResponse[0].gender = APIdata[0].gender;
              }

          // Fulfill the request with the mock data
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockResponse),
          });
        });

        // Extract parameters
        const elementIdParam = event.click_id;
        const pageTitle = event.page_title;
        //const keypressParam = event.event_params.find(param => param.key === 'count'); // Not used for typing

        //Get current URL
      /*var curURL = "";
      for (const event of events) {
        if (event.event_name === 'page_location') {
          curURL = event.value.string_value; 
      }}
      console.log(`Current URL: ${curURL}`);
      console.log(`Site URL: ${page.url()}`);*/

        // Perform actions based on event_name
        if (pageTitle === "Login"){
          console.log("Not a valid entry: Page is 'Login'");
        }
        else
          {
          if (event.event_name === 'click_button') {
                if (testURL(event, page)) {
                  if (elementIdParam) {
                    // Check if element exists on the page
                    const element = await page.$(`#${elementIdParam}`);
                    if (element) {
                      //console.log('Element found. Clicking:', elementIdParam);
                      lastClickedElementId = elementIdParam;
                      await page.click(`#${lastClickedElementId}`);
                      await page.waitForTimeout(1000);
                    } 
                    //button not found on page
                    else {
                      console.log(`Element with ID '${elementIdParam}' not found on page.`);
                    }
                  } 
                  // if there is no click_id but the event is click_button
                  else {
                    console.log("Not a valid entry: click_id is null");
                  }
                }
          } 
          else if (event.event_name === 'press_key') {
              // Use the last clicked element's ID (from the previous click event)
              if (lastClickedElementId) {
                // Generate a random letter from A to Z
                const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                // Type the random letter into the last clicked element
                await page.type(`#${lastClickedElementId}`, randomLetter, { delay: 100 });
                console.log(`Typed: ${randomLetter}`);
                await page.waitForTimeout(400);
              } else {
                console.log('No previous click event found to get the element ID.');
              } 
          }
        else if (event.event_name == 'session_start' || event.event_name == 'page_view')
            {
            curURL = page.url();
            if (curURL != event.page_location)
                {
                  await page.goto(event.page_location);
                  await page.waitForTimeout(2000);
                }
            }
        }

        /*else if (event.event_name == 'page_view')
            {
            if (page.url != event.page_location)
              {
              console.log(`Going to ${event.page_location}`)
              await page.goto(event.page_location);
              }
            }*/

        // Add delay to simulate user interaction
      }

      // Close the browser
      await browser.close();
    } catch (error) {
      console.error('Error parsing JSON or performing actions:', error);
    }
  });
}

function testURL(event, page) //test if on correct URL
{
  return true;
/*const urlIDParam = event.page_location; //Used for getting URL
if (urlIDParam)
  {
    var curURL = urlIDParam;
    if (curURL == page.url())
    {
    return true;
    }
  }
return false;*/
}

async function GetAPIData(event)
{
  await sql.connect(config);
  const result = await sql.query`
  SELECT jsondata, timestamp FROM API_Info 
  WHERE ga_psuedo = ${event.user_pseudo_id} AND ga_session = ${event.ga_session_number} AND date = ${event.event_date}
  ORDER BY timestamp ASC`;
    
  //console.log(result);

  sql.close();
  if (result.recordset.length > 0)
      {
      //console.log(result.recordset);
      return result.recordset;
      }
  return null;
}

module.exports = { setJsonDataPath, playbackFile };
