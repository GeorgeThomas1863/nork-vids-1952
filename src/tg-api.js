import fs from "fs";
import FormData from "form-data";
import axios from "axios";

import tokenArray from "../config/tg-bot.js";

let tokenIndex = 0;

//--------------------------------

export const tgSendMessage = async (inputParams) => {
  const { chatId, text } = inputParams;
  const token = tokenArray[tokenIndex];

  const params = {
    chat_id: chatId,
    text: text,
  };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const data = await tgPostReq(url, params);

  const checkData = await checkToken(data);

  //try again
  if (!checkData) return await tgSendMessage(inputParams);

  return data;
};


export const tgEditMessageCaption = async (inputParams) => {
  const { editChannelId, messageId, caption } = inputParams;
  const token = tokenArray[tokenIndex];

  const params = {
    chat_id: editChannelId,
    message_id: messageId,
    caption: caption,
    parse_mode: "HTML",
  };

  const url = `https://api.telegram.org/bot${token}/editMessageCaption`;
  const data = await tgPostReq(url, params);

  const checkData = await checkToken(data);

  //try again
  if (!checkData) return await tgEditMessageCaption(inputParams);

  return data;
};

export const tgPostReq = async (url, params) => {
  if (!url || !params) return null;

  try {
    const res = await axios.post(url, params);
    return res.data;
  } catch (e) {
    console.log(e.message);
    //axios throws error on 429, so need to return
    return e.response.data;
  }
};

export const tgPostPicFS = async (inputParams) => {
  const { chatId, picPath } = inputParams;
  const token = tokenArray[tokenIndex];

  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  //build form
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", fs.createReadStream(picPath));

  try {
    const res = await axios.post(url, form, {
      headers: form.getHeaders(),
    });

    // console.log("RES");
    // console.log(res.data);
    // console.log("--------------------------------");

    // const checkData = await checkToken(res.data);

    // //retry if needed
    // if (!checkData) return await tgPostPicReq(inputParams);

    return res.data;
  } catch (e) {
    if (e.response && e.response.data) {
      //check token
      const checkData = await checkToken(e.response.data);

      //retry
      if (!checkData) return await tgPostPicFS(inputParams);
    } else {
      //otherwise throw error
      const error = new Error("UPLOAD PIC FUCKED");
      console.log(e);
      error.function = "tgPostPicFS";
      error.content = inputParams;
      throw error;
    }
  }
};

export const tgPostVidFS = async (inputParams) => {
  const { form } = inputParams;
  const token = tokenArray[tokenIndex];

  const url = `https://api.telegram.org/bot${token}/sendVideo`;

  try {
    const res = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // console.log("!!!!!!RES");
    // console.log(res.data);

    return res.data;
  } catch (e) {
    if (e.response && e.response.data) {
      //check token
      const checkData = await checkToken(e.response.data);

      //retry
      if (!checkData) return await tgPostVidFS(inputParams);
    } else {
      const error = new Error("UPLOAD VID FUCKED");
      error.function = "tgPostVidFS";
      error.content = inputParams;
      throw error;
    }
  }
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
