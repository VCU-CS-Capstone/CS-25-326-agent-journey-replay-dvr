//THIS IS THE CODE FOR A MANUAL READING OF THE PLAYWRIGHT

const fs = require('fs');
const { chromium } = require('playwright');
const sql = require('mssql')
const readline = require('readline');

//Default path to your JSON file
let jsonDataPath = 'test.json';

//Azure SQL connection configuration
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


function setJsonDataPath_Man(newPath) {
  jsonDataPath = newPath;
}

async function playbackFile_Man() {
  console.log('playwright starting');
  //Read json clickstream
  fs.readFile(jsonDataPath, 'utf-8', async (err, data) => {
    if (err) {
      console.error('Error reading JSON file:', err);
      return;
    }
    //Iterate through json data
    try {

      const events = JSON.parse(data);
      const APICalls = await GetAPIData(events[0]);
      let curAPICall = 0;

      // Start Playwright
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      //Go to our page
      await page.goto('https://capitaloneagentdashboard.azurewebsites.net');
      
      //Skip guest login
      console.log("Logging in as guest");
      await page.click(`#guestLogin`);

      // Variable to track the last clicked element ID
      let lastClickedElementId = null;

      //Store where we are in the clickstream
      let currentEventIndex = 0;  

      //Array that stores what's been entered (keys wise)
      const inputHistory = [];

      //Get user input 'A' or 'D'
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Function to process events
      const processEvent = async () => {
        
        //Get event (click_button)
        const event = events[currentEventIndex];

        //Get page element
        const elementIdParam = event.click_id
        
        //Page title
        const pageTitle = event.page_title;


        try {
          //If it's a login page print it out
          if (pageTitle === "Login"){
            console.log("Not a valid entry: Page is 'Login'");
          }


          else if (event.event_name === 'click_button') {
            if (elementIdParam) {
              //console.log('Checking for element with ID:', elementIdParam);
              
              // Check if element exists on the page
              const element = await page.$(`#${elementIdParam}`);

              //Click this elemenet
              if (element) {
                //console.log('Element found. Clicking:', elementIdParam);
                lastClickedElementId = elementIdParam;
                await page.click(`#${lastClickedElementId}`);
                //await page.waitForTimeout(2000); // Wait for interaction to settle
              } 
              //Otherwise throw an error
              else {
                console.log(`Element with ID '${elementIdParam}' not found on page.`);
              }
            } 
            //Not a valid element, null
            else {
              console.log("Not a valid entry: click_id is null");
            }
          } 
          //key press event
          else if (event.event_name === 'press_key') {
            // If the last clicked element is available, type into it
            if (lastClickedElementId) {
              console.log(`Typing into element with ID: ${lastClickedElementId}`);

              //Random letter, we don't want to enter what the user pressed
              const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
              //Add a delay for each typed key
              await page.type(`#${lastClickedElementId}`, randomLetter, { delay: 100 });
              //Add this to the list (element, letter, and index of this current step), so when we go backwards and show we remove it we can remove it out of the correct text box and value.
              inputHistory.push({ elementId: lastClickedElementId, value: randomLetter, eventIndex: currentEventIndex });
              console.log(`Typed: ${randomLetter}`);
            }
          }

          else if (event.event_name == 'session_start' || event.event_name == 'page_view')
            {
            curURL = page.url();
            if (curURL != event.page_location)
                {
                  await page.goto(event.page_location); // Replace with your target website
                }
            }
          

        } catch (error) {
          console.error(`Error during event processing: ${error.message}`);
        }

        // Wait for user input 'A' or 'D' to iterate
        rl.question(`Press A (previous) or D (next) to continue: `, async (answer) => {
          if (answer === 'a') {
            //Previous event, make sure we're not already at the start
            if (currentEventIndex > 0) {
              currentEventIndex--
              console.log('Going to previous event');

              // Check if the event was a text input
              const undoneInput = inputHistory.findLast(input => input.eventIndex === currentEventIndex);
              if (undoneInput) {
                console.log(`Undoing input in #${undoneInput.elementId}: removing '${undoneInput.value}'`);
                const currentValue = await page.inputValue(`#${undoneInput.elementId}`);
                //Remove character manually
                const newValue = currentValue.slice(0, -1);
                await page.fill(`#${undoneInput.elementId}`, newValue);

                //remove from inputHistory
                inputHistory.pop(); 
              }

            } else {
              console.log('Already at the first event.');
            }
          } else if (answer === 'd') {
            // Go to the next event, make sure we're not going further than the json
            if (currentEventIndex < events.length - 1) {
              currentEventIndex++;
              console.log('Going to next event');
              console.log(currentEventIndex);
            } else {
              console.log('Already at the last event.');
            }
          } 
          //Close down the browser
          else if(answer === 'q'){
            rl.close(); 
            await browser.close();
            process.exit(0);
          }
          else {
            console.log('Invalid input. Please press ArrowLeft or ArrowRight.');
          }

          // Call the processEvent again after user input
          if (currentEventIndex < events.length) {
            processEvent();
          } else {
            console.log('Finished processing all events.');
            rl.close();
            await browser.close();
          }
        });
      };

      // Start processing events
      processEvent();

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
  SELECT user_name, timestamp FROM API_Info 
  WHERE ga_psuedo = ${event.user_pseudo_id} AND ga_session = ${event.ga_session_number} AND date = ${event.event_date}
  ORDER BY timestamp ASC`;
    
  sql.close();
  if (result.recordset.length > 0)
      {
      //console.log(result.recordset);
      return result.recordset;
      }
  return null;
}

module.exports = { setJsonDataPath_Man, playbackFile_Man};
