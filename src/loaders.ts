import {Container} from "typedi";

import config from "./config";
import DbConnector from "./persistence/repos/db-connector";

export interface Dep {
  name: string;
  path: string;
}

export default () => {

  DbConnector.getInstance().connect(); // for a quicker startup, don't await

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
