// const { fetchToken, connectToWebSocket } = require('./auth');
// const PicartoChatManager = require('./chatManager');
// const fs = require('fs');
// const EOL = require('os').EOL;

import { fetchToken, connectToWebSocket } from './auth';
import PicartoChatManager from './chatManager';
import fs from 'fs';
import { EOL } from 'os';


const notifyOwner = JSON.parse(fs.readFileSync('./config/keys.json', 'utf8')).notifyOwner;

const getBannedUsers = () => {
  let lines = fs.readFileSync('./config/banned_users.txt', 'utf8').toLowerCase().replace(/\r/g, '').split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (line.indexOf('#') === 0 || line.replace(/ /g, '').length === 0) {
      lines.splice(i, 1);
      i--;
      continue;
    }
    if (line.includes('#')) {
      lines[i] = line.substring(0, line.indexOf('#')).trim();
    }
  }

  return lines;
}

const handleUnban = (displayName) => {
  const lines = fs.readFileSync('./config/banned_users.txt', 'utf8').toLowerCase().replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.includes('#')) {
      if(line.substring(0, line.indexOf('#')).trim() === displayName.toLowerCase()) {
        lines.splice(i, 1);
        break;
      }
    }
  }

  fs.writeFileSync('./config/banned_users.txt', lines.join(EOL), 'utf8');
}

const handleBan = (displayName, ban, {isShadowBan, newBan, reason, updateListOnly}) => {
  if (newBan) {
    let bannedList = fs.readFileSync('./config/banned_users.txt', 'utf8').toLowerCase().replace(/\r/g, '').split('\n');
    bannedList += `${EOL}${displayName} # ${reason ? `reason: ${reason}` : ''}; timestamp: ${Date.now()}`;
    fs.writeFileSync('./config/banned_users.txt', bannedList, 'utf8');
    if (updateListOnly) return;
  }

  ban(displayName, isShadowBan);
}

const handleWarn = (msg, word, whisper, banFn) => {
  const warnings = fs.readFileSync('./config/user_warnings.txt', 'utf8').toLowerCase().replace(/\r/g, '');
  const lines = warnings.split('\n');

  let i;
  for (const [idx, line] of lines.entries()) {
    if (line.startsWith('= tolerence:')) {
      i = idx;
      break;
    }
  }

  console.log(lines);
  let tolerence = parseInt(lines[i].substring(lines[i].indexOf(':') + 1));
  i++;
  
  let header = [];
  for (; i >= 0; i--) header.push(lines.shift());
  let data = JSON.parse(lines.join(''));

  // warnings are less severe, 
  // so i'm gonna be a tad bit lazy here for now
  // and just use display names
  if (!data[msg.displayName]) {
    data[msg.displayName] = {};
  }
  if (!data[msg.displayName][word]) {
    data[msg.displayName][word] = 0;
  }
  data[msg.displayName][word]++;

  if (tolerence !== -1 && data[msg.displayName][word] > tolerence) {
    handleBan(msg.displayName, banFn, {newBan: true, reason: `used the word/phrase "${word}" more than ${tolerence} times`});
  } else {
    if (tolerence === -1) whisper(msg.displayName, `your message was deleted for the use of ${word}"`);
    else {
      whisper(
        msg.displayName, 
        `warning: your message was deleted for the use of: "${word}"; warnings left for this word before ban: ${tolerence - data[msg.displayName][word]}`
      )
    }
  }

  fs.writeFileSync('./config/user_warnings.txt', header.join(EOL) + EOL + JSON.stringify(data, null, 2), 'utf8');
}

const checkBlacklist = (msg, category) => {
  const warnedWords = fs.readFileSync('./config/blacklist.txt', 'utf8').replace(/\r/g, '').split('\n');
  for (let i = warnedWords.indexOf(category) + 2; i < warnedWords.length; i++) {
    const word = warnedWords[i].replace(/ /g, '');
    
    // stops when it finds the next separator (====...) 
    if (/^=*$/.test(word)) break;

    // ignores comments (lines starting with #)
    // and empty lines
    if (word.startsWith('#')
        || word.replace(/ /g, '').length == 0) { 
      continue;
    }

    // console.log(word);

    // further ignores comments
    if (word.includes('#')) word = word.substring(0, word.indexOf('#'));

    if (word.includes('/') 
        && word.indexOf('/') !== word.lastIndexOf('/')) {
      let regex = new RegExp(word.substring(1, word.lastIndexOf('/')), 'gi');
      console.log(regex);
      if (regex.test(msg.message.replace(/ /g, ''))) return word;
    }

    if (msg.message.replace(/ /g, '').includes(word)) return word;
  }

  return false;
}

const getWhitelistedUsers = () => {
  let owner = JSON.parse(fs.readFileSync('./config/keys.json', 'utf8')).username.toLowerCase();
  let lines = fs.readFileSync('./config/whitelisted_users.txt', 'utf8').toLowerCase().replace(/\r/g, '').split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (line.indexOf('#') === 0 || line.replace(/ /g, '').length === 0) {
      lines.splice(i, 1);
      i--;
      continue;
    }
    if (line.includes('#')) {
      lines[i] = line.substring(0, line.indexOf('#')).trim();
    }
  }

  lines.unshift(owner);
  return lines;
}

(async () => {
  let whiteListedUsers = getWhitelistedUsers();
  console.log(whiteListedUsers);

  const picartoChat = await connectToWebSocket(await fetchToken());
  const picartoChatManager = new PicartoChatManager(picartoChat);

  setTimeout(() => {

    picartoChatManager.on("ChatMessage", (msg) => {
      msg.message = msg.message.toLowerCase();
      if (getWhitelistedUsers().includes(msg.displayName.toLowerCase())) return;
  
      if (getBannedUsers().includes(msg.displayName.toLowerCase())) {
        picartoChatManager.banUser(msg.displayName);
        return;
      }
  
      let trigger = '';
      if ((trigger = checkBlacklist(msg, '= SHADOWBAN'))) {
        picartoChatManager.removeMessage(msg);
        handleBan(msg.displayName, picartoChatManager.banUser, {newBan: true, reason: `used shadowbanned word/phrase: ${trigger}`, isShadowBan: true}, picartoChatManager.sendWhisper);
        if (notifyOwner) {
          picartoChatManager.sendWhisper(whiteListedUsers[0], `${msg.displayName} has been banned for using the word/phrase, "${trigger}" (shadow)`);
        }
      }
      else if ((trigger = checkBlacklist(msg, '= BAN'))) {
        picartoChatManager.removeMessage(msg);
        handleBan(msg.displayName, picartoChatManager.banUser, {newBan: true, reason: `used banned word/phrase: ${trigger}`})
        if (notifyOwner) {
          picartoChatManager.sendWhisper(whiteListedUsers[0], `${msg.displayName} has been banned for using the word/phrase, "${trigger}"`);
        }
      }
      else if ((trigger = checkBlacklist(msg, '= WARNING'))) {
        picartoChatManager.removeMessage(msg);
        handleWarn(msg, trigger, picartoChatManager.sendWhisper, picartoChatManager.banUser);
      }

    })
  
    picartoChatManager.on("Ban", (msg) => {
      // whiteListedUsers[0] will ALWAYS be the owner
      if (msg.executionerDisplayName !== whiteListedUsers[0]) {
        handleBan(msg.displayName, null, {
          newBan: true,
          reason: `banned by ${msg.executionerDisplayName}`,
          updateListOnly: true
        })
        if (notifyOwner) {
          picartoChatManager.sendWhisper(whiteListedUsers[0], `${msg.executionerDisplayName} has swung the banhammer on ${msg.displayName}${msg.shadowBan ? ' (shadow)' : ''}`);
        }
      }
    })
  
    picartoChatManager.on("UnBan", (msg) => {
      // whiteListedUsers[0] will ALWAYS be the owner
      handleUnban(msg.displayName);
      if (msg.executionerDisplayName !== whiteListedUsers[0] && notifyOwner) {
        picartoChatManager.sendWhisper(whiteListedUsers[0], `${msg.displayName} has been unbanned by ${msg.executionerDisplayName}`);
      }
    })

  }, 1000)
})();