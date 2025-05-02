//header
const readline = require('readline');
const fs = require('fs').promises;
const {setJsonDataPath, playbackFile} = require('./json_playwright.js');
const {setJsonDataPath_Man, playbackFile_Man} = require('./json_playwright_man.js');
//endheader
process.removeAllListeners('warning');

const targetPseudoId = "1821647616.1731013490";
const userDataPath = 'userdata.json';

const {BigQuery} = require('@google-cloud/bigquery');
const { query } = require("mssql");
const bigquery = new BigQuery();
process.env.GOOGLE_APPLICATION_CREDENTIALS = './bq_key.json';

async function queryData(date) {
    try {
    const query = `SELECT event_name, event_date, event_timestamp,event_params, user_id, user_pseudo_id FROM capital-one-440308.analytics_464954921.events_${date} LIMIT 1000`;
    const options = {
      query: query,
    };
    //const [rows] = await bigquery.query(options);
    const newdata = await bigquery.query(options);
    //console.log('Query results:' + newdata);
    //rows.forEach(row => console.log(row));

    return newdata;
    }
    catch {
        return null;
    }   
  }

  async function writeData(bodyText) {
    try {
        await fs.writeFile('./data.json', bodyText);
    } catch (err) {
        console.error("Write failed:", err);
    }
}

// Create an async function to handle the async operations
async function main() {
    date = await GetUserInput("Please enter a date to retrieve website data from (YYYYMMDD): ");
    newdata = await queryData(date);
    while (newdata == null)
        {
        date = await GetUserInput("Invalid date entered. Please enter a date to retrieve website data from (YYYYMMDD): ");
        newdata = await queryData(date);
        }

    //console.log(JSON.stringify(newdata[0], null, 2));

    await writeData(JSON.stringify(newdata[0], null, 2));
    data = JSON.parse(await fs.readFile("./data.json"));

    // getting user input
    usernameList = GetUserName(data);
    username = await GetUserInput("Please enter a username ID: ");

    realUser = null;
    realUser = validateUserName(usernameList,username);
    while (realUser == null)
        {
        username = await GetUserInput("Username invalid. Please enter a username ID: ");
        realUser = validateUserName(usernameList,username);
        }
    

    userList = GetAllUsers(data,realUser);
    user = await GetUserInput("Please enter a data stream ID: ");
    sessionList = GetAllSessions(data, userList[user]);
    session = await GetUserInput("Please enter a session ID: ");
    //GetAllEventsFromID(userList[user],sessionList[session]);
    fs.writeFile(userDataPath, ReformatJSON(JSON.stringify(GetAllEventsFromID(data,userList[user],sessionList[session])), null, 2), (err) => err && console.error(err));
    
    //gets user input for whether to automate the playback or not
    manual = await GetUserInput("Would you like this playback to be automated? (Y/N)\n");
    manwords = manual.split(" ")
    while (manwords[0].toLowerCase() != "y" && manwords[0].toLowerCase() != "n")
        {
        manual = await GetUserInput("Would you like this playback to be automated? (Y/N)");
        manwords = manual.split(" ")
        }
    
    if (manwords[0].toLowerCase() == "y")
        {
        setJsonDataPath(userDataPath);
        //console.log(manwords[1]);
        if (!isNaN(manwords[1]))
            {
            playbackFile(parseInt(manwords[1]));
            }
        else
            {
            playbackFile();
            }
        }
    else
        {
        setJsonDataPath_Man(userDataPath);
        playbackFile_Man();
        }
}

main(); // Call the async main function

function validateUserName(userList, userInput)
{
if (isNaN(userInput)) //if username is direct search
    {   
    for (i = 0; i < userList.length; i++)
        {
        if (userInput == userList[i])
            {
            return userList[i];
            }
        }   
    }
else //if username is a number id
    {
    if (userInput >= 0 && userInput < userList.length)
        {
        return userList[userInput];
        }
    }
return null;
}

function GetAllEventsFromID(data,userID, sessionID = null) {
    if (sessionID != null)
    {
    const clickEvents = data.filter(event => event.user_pseudo_id === userID
        &&
        event.event_params.some(param => param.key === 'ga_session_number' && param.value.int_value === sessionID));

    clickEvents.sort(function (a, b) {
        return a.event_timestamp  - b.event_timestamp ;
      });
      
    //console.log(clickEvents);
    return clickEvents;
    }
    else
    {
        const clickEvents = data.filter(event => event.user_pseudo_id === userID);
    
        clickEvents.sort(function (a, b) {
            return a.event_timestamp  - b.event_timestamp ;
          });
          
        //console.log(clickEvents);
        return clickEvents;
    }
}

function ReformatJSON(baseJSON) {
    const unSortedData =  JSON.parse(baseJSON);
    newJSON = new Array(unSortedData.length);
    console.log("-------");
    for (i = 0; i < unSortedData.length; i++)
    {
    newJSON[i] = {
        event_name: unSortedData[i].event_name,
        event_date: unSortedData[i].event_date,
        event_timestamp: unSortedData[i].event_timestamp,
        ga_session_number: getEventParamData(unSortedData[i], "ga_session_number"),
        click_id: getEventParamData(unSortedData[i], "click_id"),
        engagement_time_msec: getEventParamData(unSortedData[i], "engagement_time_msec"),
        page_referrer: getEventParamData(unSortedData[i], "page_referrer"),
        ga_session_id: getEventParamData(unSortedData[i], "ga_session_id"),
        page_title: getEventParamData(unSortedData[i], "page_title"),
        user_id: getEventParamData(unSortedData[i], "user_id"),
        user_pseudo_id:unSortedData[i].user_pseudo_id,
        page_location: getEventParamData(unSortedData[i], "page_location")
    };
    }
    console.log(newJSON);
    return JSON.stringify(newJSON, null, 2);
}

function getEventParamData(event, eventParam) {
    const sessionParam = event.event_params.find(param => param.key === eventParam);
    if (sessionParam) 
        {
        if (sessionParam.value.int_value)
            {
            return sessionParam.value.int_value;
            }
        else if (sessionParam.value.string_value)
            {
            return sessionParam.value.string_value;
            }
        else if (sessionParam.value.float_value)
            {
            return sessionParam.value.float_value;
            }
        else if (sessionParam.value.double_value)
            {
            return sessionParam.value.double_value;
            }
        }
    else 
        {
        return null;
        }
}

//function takes text for variety of prompts, then reads user input 
function GetUserInput(text) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(text, u_input => {
        rl.close();
        resolve(u_input);
    }));
}

//lists all psuedo_users captured in data
function GetAllUsers(data, username)
{   
    const finalUsers = [];
    const users = data.filter(event => event.user_id == username).map(event => event.user_pseudo_id);

    for (const user of users) {
        if (!finalUsers.includes(user))
            {
            finalUsers.push(user)
            }
        }
    console.log("Data Stream List:\n");

    for (let i = 0; i < finalUsers.length; i++) {
        timerange = GetTimeRange(data,finalUsers[i]);
        console.log("[" + i + "] = "+finalUsers[i]+ " | " + timerange, "\n");
      }
    return finalUsers;
}

function GetAllSessions(data,userID)
{
    const finalSessions = [];
    // Filter events by user ID and map to session IDs
    const sessionIds = data.flatMap(event => 
        event.user_pseudo_id === userID 
            ? event.event_params
                .filter(param => param.key === 'ga_session_number')
                .map(param => param.value.int_value)
            : []
    );

    for (const session of sessionIds) {
        if (!finalSessions.includes(session))
            {
                finalSessions.push(session)
            }
        }
    console.log("Session List:\n");

    for (let i = 0; i < finalSessions.length; i++) {
        timerange = GetTimeRange(data,userID,finalSessions[i]);
        console.log("[" + i + "] = "+finalSessions[i]+ " | " + timerange, "\n");
      }
    return finalSessions;
}

function GetUserName(data)
{
    const finalUsernames = [];
    // Filter events by user ID and map to session IDs
    const usernames = data.flatMap(event => event.user_id);

    for (const user of usernames) {
        if (!finalUsernames.includes(user) && user != "null")
            {
                finalUsernames.push(user)
            }
        }
    console.log("User List:\n");

    for (let i = 0; i < finalUsernames.length; i++) {
        console.log("[" + i + "] = "+finalUsernames[i], "\n");
      }
    return finalUsernames;
}

function GetTimeRange(data, psuedo, session = null)
{
timestamp = "";
rawevents = GetAllEventsFromID(data,psuedo,session);
eventJSON = JSON.stringify(rawevents);
const eventlist =  JSON.parse(eventJSON);

timestamp += formatUTC(UTC_Convert(eventlist[0].event_timestamp).toString()) + 
" - " + formatUTC(UTC_Convert(eventlist[eventlist.length-1].event_timestamp).toString());
return timestamp;
}

function formatUTC(time) //gets rid of the date of the UTC, keeps only the hours, minutes and seconds
{
const matches = time.match(/\d{2}:\d{2}:\d{2} GMT[+-]\d{4}/g);
const result = matches.join(' - ');
return result;
}

function UTC_Convert(unix_timestamp)
{
var date = new Date(unix_timestamp / 1000);
return date;
}