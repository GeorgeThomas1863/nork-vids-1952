import fs from "fs";
import FormData from "form-data";
import axios from "axios";

import CONFIG from "../config/config.js";
import tokenArray from "../config/tg-bot.js";
import dbModel from "../models/db-model.js";
import tokenArray from "../config/tg-bot.js";

let tokenIndex = 0;

//--------------------------------

export const tgPostPicReq = async (url, params) => {
  const { chatId, picPath } = params;

  //build form
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", fs.createReadStream(picPath));

  try {
    const res = await axios.post(url, form, {
      headers: form.getHeaders(),
    });
    return res.data;
  } catch (e) {
    console.log(e.message);
    return e.response.data;
  }
};

export const tgEditMessageCaption = async (inputParams) => {
  const { baseURL } = CONFIG;
  const { editChannelId, messageId, caption } = inputParams;
  const token = tokenArray[tokenIndex];

  const params = {
    chat_id: editChannelId,
    message_id: messageId,
    caption: caption,
  };

  const url = `${baseURL}${token}/editMessageCaption`;
  const data = await tgPostReq(url, params);

  const checkData = await checkToken(data);

  //try again
  if (!checkData) return await tgEditMessageCaption(inputParams);

  return data;
};

//------------------------

export const checkToken = async (data) => {
  if (data && data.ok) return true;

  if (data && data.error_code && data.error_code !== 429) return true;

  console.log("HERE FAGGOT");
  console.log(data);

  //otherwise bot fucked, return null
  console.log("AHHHHHHHHHHHHH");
  tokenIndex++;

  if (tokenIndex > 11) tokenIndex = 0;

  console.log("CANT GET UPDATES TRYING NEW FUCKING BOT. TOKEN INDEX:" + tokenIndex);
  return null;
};
