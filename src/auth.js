// const fetch = require('node-fetch');
// const qs = require('querystring');
// const WebSocket = require('ws');

// const fs = require('fs');

import fetch from 'node-fetch';
import qs from 'querystring';
import WebSocket from 'ws';

import fs from 'fs';

export const fetchToken = async () => {
  const keys = JSON.parse(fs.readFileSync('./config/keys.json', 'utf8'));
  keys.api = "https://api.picarto.tv/v1";
  
  const params = {
    bot: true,
    channel_id: JSON.parse(await (await fetch(`${keys.api}/channel/name/${keys.username}`)).text()).user_id
  }

  const req = await fetch(keys.api + '/user/jwtkey?' + qs.stringify(params), {
    headers: {
      "Authorization": `Bearer ${keys.token}`
    }
  })

  switch (req.status) {
    case 200: 
      console.log("Authentication Successful: JWT key successfully generated!")
      break;
    case 400: 
      console.log('Code 400:\nbad request');
      return;
    case 403: 
      console.log('Code 403:\nApplication not authorized to generate a JWT token for this user.');
      return;
    case 404: 
      console.log(`Code 404:\nThe channel, ${consts.channelId}, does not exist.`);
      return;
  }

  return await req.text();
}

export const connectToWebSocket = async (token) => {
  const ws = new WebSocket("wss://nd2.picarto.tv/socket?token=" + token);
  return ws;
}