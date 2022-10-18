import {Container} from "typedi";
import express from "express";

import config from "./config";
import DbConnector from "./persistence/repos/dbConnector";
import fs from "fs";
import {sendMessage} from "./bot/general";

export interface Dep {
  name: string;
  path: string;
}

export default () => {

  //#region server
  const app = express();

  app.get('/', (req, res) =>
    fs.readFile('./index.html', 'utf8', (err, html) => {
      if (err) res.status(500).send('Sorry, out of order');
      res.send(html);
    })
  );

  app.listen(process.env.PORT || 15000, () => sendMessage(config.adminChatId, 'Site is up in ' + config.runningEnv));
  //#endregion

  DbConnector.getInstance().connect(); // to speed up startup, don't await

  const loadDep = (dep: Dep) => {
    // load the @Service() class by its path
    let class_ = require(dep.path).default;
    // create/get the instance of the @Service() class
    let classInstance = Container.get(class_);
    // rename the instance inside the container
    Container.set(dep.name, classInstance);
    console.log(`[DI] 👌 ${dep.name} loaded`);
  };

  [config.deps.repo, config.deps.service]
    .forEach(deps =>
      Object.values(deps).forEach(loadDep)
    );

  console.log(`[DI] \u{1f5ff} the dependencies are loaded bro \u{1f5ff}\n`);

}
