import express from "express";
import {Container} from "typedi";
import fs from "fs";

import config from "./config";
import {filesFolder} from "./config/constants";
import IBotUtilsService from "./service/iService/telegramBot/iBotUtils.service";

export default () => {

  const app = express();

  app.get('/', (req, res) =>
    fs.readFile(`${filesFolder}/index.html`, 'utf8', (err, html) => {
      if (err) res.status(500).send('Sorry, out of order');
      res.send(html);
    })
  );

  app.listen(process.env.PORT || 15000, async () => {
    const botUtils = Container.get(config.deps.service.botUtils.name) as IBotUtilsService;
    await botUtils.sendMessage(botUtils.adminChatId, 'Site is up in ' + config.runningEnv);
  });

}
