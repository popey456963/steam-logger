var SteamUser = require('steam-user'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    readlineSync = require('readline-sync'),
    logger = require('log-js')('index.js'),
    SteamID = require('steamid'),
    config = require('./config.js');

if (!fs.existsSync(config.storageFile)) {
    mkdirp.sync(config.storageFile);
    var writeMe = {
        users: []
    };
    fs.writeFileSync(config.storageFile + "/loggedusers.json", JSON.stringify(writeMe, null, 4));
}


var loggedUsers = JSON.parse(fs.readFileSync(config.storageFile + "/loggedusers.json"));

var steamClient = new SteamUser();

var username = config.SteamName || readlineSync.question('Enter Steam username: ');
var password = config.SteamPass || readlineSync.question('Enter Steam password: ', {
    hideEchoBack: true
});

steamClient.logOn({
    accountName: username,
    password: password
});

steamClient.on('loggedOn', function () {

    logger.success("Logged into Steam!");
    steamClient.setPersona(3);
    checkHistory();
    setInterval(checkHistory, config.reloadInterval);

});

steamClient.on('error', function (err) {

    logger.error(err);

});

steamClient.on('friendTyping', function(senderID){

    var steamid3 = new SteamID("[U:1:" + senderID.accountid + "]");
    var steamid64 = steamid3.getSteamID64();

    for (var i=0;i<loggedUsers.users.length;i++) {
        if (loggedUsers.users[i] == steamid64) {
            return;
        }
    }

    loggedUsers.users.push(steamid64);
    fs.writeFileSync(config.storageFile + "/loggedusers.json", JSON.stringify(loggedUsers, null, 4));

    logger.log("Commence logging messages from: " + steamid64);

});

steamClient.on('chatHistory', function(steamID, success, messages){

    if (success != SteamUser.Steam.EResult.OK) {

        logger.error("Error retreiving chat history: " + success);
        return;

    }

    var steamid64 = steamID.getSteamID64();

    if (!fs.existsSync(config.storageFile + "/" + steamid64)) {

        logger.log("Creating folder for: " + steamid64);
        mkdirp.sync(config.storageFile + "/" + steamid64);
        fs.writeFileSync(config.storageFile + "/" + steamid64 + "/main.log", "", 'utf-8');

        var writeMeI = {
            lastStamp: 0
        };

        fs.writeFileSync(config.storageFile + "/" + steamid64 + "/info.json", JSON.stringify(writeMeI, null, 4));

    }

    var writeMe = "";
    var infoJ = JSON.parse(fs.readFileSync(config.storageFile + "/" + steamid64 + "/info.json"));
    var lastStamp = infoJ.lastStamp;
    var newMessages = false;

    for (var i=0;i<messages.length;i++) {

        var date = messages[i].timestamp;

        var newMonth = date.getMonth() + 1;
        var newHour = date.getHours() + 1;
        var newMinute = date.getMinutes() + 1;
        var newSecond = date.getSeconds() + 1;
        var currentStamp = date.getTime();

        if(lastStamp >= currentStamp) {
            //  Do not write messages which have already been logged.

            continue;
        }

        newMessages = true;

        var timePrefix = "[" + date.getDate() + "/" + newMonth + "/" + date.getFullYear() + " " + newHour + ":" + newMinute + ":" + newSecond + "] ";


        var personaPrefix = "";
        if (messages[i].steamID.accountid == steamClient.steamID.accountid) {
            // It is us.

            personaPrefix = config.yourPrefix;
        } else {

            personaPrefix = config.theirPrefix;

        }

        writeMe += timePrefix + personaPrefix + messages[i].message + "\n";

    }

    if (newMessages) {

        fs.appendFileSync(config.storageFile + "/" + steamid64 + "/main.log", writeMe);

        var writeMeA = {
            lastStamp: currentStamp
        };
        fs.writeFileSync(config.storageFile + "/" + steamid64 + "/info.json", JSON.stringify(writeMeA, null, 4));
        logger.log("Appended logs for: " + steamid64);

    }

});

//  Fire the chatHistory event for every user who has talked to me every x seconds.
function checkHistory() {
    for (var i=0;i<loggedUsers.users.length;i++) {
        var steamid64 = loggedUsers.users[i];
        steamClient.getChatHistory(steamid64);
    }
}
