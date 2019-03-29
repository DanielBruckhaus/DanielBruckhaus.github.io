import {version, solutionVersion,releasedOn} from './version.js';
import data from './data.js';

const WEBAPIURL = getWebApiUrl();

async function Install () {
  debugger;
  const {UserId} = await whoAmI();

  const {values:solutions} = await webapiRetrieveMultiple("solutions", {select: "uniquename,version"});

  const installedTB = solutions.find(s => s.uniquename === "ORBISJSToolbox");
  const installedVersion = installedTB ? installedTB.version : null;


  if(installedVersion) {
    const ok = await confirmDialog(`Replace installed Version ${installedVersion} with version ${solutionVersion} (JSToolbox Version ${version})?`);

    if(!ok) return;
  }
  else {
    const ok = await confirmDialog(`Install JSToolbox version ${version}?`);

    if(!ok) return;
  }

  debugger;

  const success = await importSolution({
    CustomizationFile: data
  });

  if(success) {
    const ok = await confirmDialog(`Installation complete. Open JSToolbox now?`);
    if(ok) {
      const cUrl = getClientUrl();
      const url = `${cUrl}/WebResources/orb_/JSToolbox/index.html`;
      window.open(url,'_blank','noopener');
    }
  }
  else {
    errorDialog(`Installation Failed`);
  }
}





async function importSolution ({CustomizationFile, ImportJobId = null, OverwriteUnmanagedCustomizations = true, PublishWorkflows = true}) {

  if(!ImportJobId) {
    ImportJobId = newGuidString();
  }

  Xrm.Utility.showProgressIndicator("Starting Import...");

  const importResp = await webapiExecuteCustomAction("ImportSolution", {
    OverwriteUnmanagedCustomizations,
    PublishWorkflows,
    CustomizationFile,
    ImportJobId
  });

  let success = false;

  try {
    while(true) {
      await sleep(100);

      const {progress, startedon, completedon} = await webapiRetrieve("importjobs", ImportJobId, ["progress", "startedon", "completedon"]);

      const start = new Date(startedon);
      const now = new Date();
      const ellapsed = Math.round((now - start)/1000);

      Xrm.Utility.showProgressIndicator(`Importing... ${Math.round(progress)}% | ${ellapsed}s ellapsed`);

      if(completedon) {
        if(progress >= 100) {
          success = true;
        }
        break;
      }
    }
  }
  catch(ex) {
    console.error(ex);
  }
  finally {
    Xrm.Utility.closeProgressIndicator();
  }
  return success;
}

async function webapiRetrieve(collection, id, fields = []) {
  let url = `${collection}(${id})`;

  if(fields && fields.length) {
    url += "?$select=" + fields.join(',');
  }

  const {data} = await webapiCall(url);
  return data;
}

function sleep(ms) {
  return new Promise((res,rej) => {
    setTimeout(res, ms);
  })
}

function newGuidString() {
  // PSUEDO Guid!
  // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

async function webapiExecuteCustomAction(name, data) {
  const {data:resp} = await webapiCall(name, {
    method: "POST",
    body: JSON.stringify(data)
  });

  return resp;
}

async function confirmDialog(msg, {
  title,
  subtitle,
  cancelButtonLabel = "Cancel",
  confirmButtonLabel = "Ok"
} = {}) {
  return new Promise((res,rej) => {
    if(Xrm && Xrm.Navigation && Xrm.Navigation.openConfirmDialog) {
      Xrm.Navigation.openConfirmDialog({text: msg, title, subtitle, confirmButtonLabel, cancelButtonLabel})
      .then(result => {
        if(result && result.confirmed) {
          res(true);
        }
        else {
          res(false)
        }
      }, rej);
    }
    else {
      const ok = confirm(msg);
      res(ok);
    }
  });
}

async function errorDialog(msg) {
  return new Promise((res,rej) => {
    if(Xrm && Xrm.Navigation && Xrm.Navigation.openAlertDialog) {
      Xrm.Navigation.openAlertDialog({text: msg})
      .then(result => {
        res();
      }, rej);
    }
    else {
      alert(msg);
      res();
    }
  });
}

async function whoAmI() {
  const {data} = await webapiCall("WhoAmI()");
  return data;
}

async function webapiRetrieveMultiple(collection, options = {}) {
  const params = Object.entries(options).map(([key,value]) => `$${key}=${value}`).join("&");
  let url = collection;
  if(params && params.length) {
    url += "?" + params;
  }
  const {data} = await webapiCall(url);
  const {value:values, "@odata.nextLink":nextLink} = data;

  return {
    values,
    nextLink
  };
}

async function webapiCall(url, {
  method = "GET",
  body = undefined,
  headers = {}
} = {}) {
  const resp = await fetch(`${WEBAPIURL}/${url}`, {
    method,
    body,
    headers: {
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });

  const {ok, status, statusText} = resp;

  if(!ok) throw new Error("Failed");

  const length = parseInt(resp.headers.get("Content-Length"));

  let data = null;

  if(length > 0 ) {
    data = await resp.json();
  }

  return {
    data,
    status,
    statusText
  }

}

function getWebApiUrl() {
  const CLIENTURL = getClientUrl();
  const WEBAPIVERSION = getWebApiVersion();
  return `${CLIENTURL}/api/data/${WEBAPIVERSION}`;
}

function getClientUrl() {
  return Xrm.Page.context.getClientUrl();
}

function getWebApiVersion () {
  const crmVersion = Xrm.Page.context.getVersion();
  const [major, minor] = crmVersion.split('.');
  return `v${major}.${minor}`;
}

export {
  Install
}
