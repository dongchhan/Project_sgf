let socket;
let globalRecvData = {};
let plot1base64;
let plot2base64;
let plot3base64;
let notyf;
let currentMode = "USER";
let currentCommand = "";
const OPTION_KEY = 'SAM_DROPLET_OPTION_V1_0';

let total_images = 0;
let customFiles = null;

let mKeyBuffer = [0, 0];

const lgchem_logo_base64 = "data:image/;base64," + ''  // base64 이미지 파일 있던 곳 

const base_url = window.location.origin;
socket = io.connect(base_url);  // ARP 

socket.on("connect", function () {
  socket.emit("client info", {
    data: "connected",
    user: document.getElementById("username").innerText, 
    sid: socket.id,
    referrer: document.referrer,
    cookie: document.cookie
  });
});

socket.on("connect response", function (msg) {
  if (msg.sid == socket.id) {
    if (msg.data == "connected") {
      notyf.success('Server Connected');
      
      const s1 = document.getElementById("serverIndicator");
      s1.classList.remove("server_off");
      s1.classList.add("server_on");
    }
  } 
});

socket.on("send iamge file", function (msg) {
  if (msg.sid == socket.id) {
    if (msg.status == 200) {
      globalRecvData[msg.index] = msg;
      globalRecvData[msg.index]["data"] = JSON.parse(globalRecvData[msg.index]["data_statistics"]);
      globalRecvData[msg.index]["detail"] = JSON.parse(globalRecvData[msg.index]["data_detail"]);
      
      const p5js_data = {
        manual_manipulate_target_scale_ratio : 1.0,
        manual_manipulate_screen_ratio : null, 
        
        manualMeasureModeSwitch : false,
        manualArrowModeSwitch : false,
        // manualRemoveModeSwitch : false,
        manualSegmentInfoModeSwitch : false, 
        
        manualRemoveMode1Switch : false,
        manualRemoveMode2Switch : false,
        manualRemoveMode3Switch : false,
        
        div_x : 0,
        div_y : 0,
        img_x : 0,
        img_y : 0,
        
        measBuffer : [],
        arrowBuffer : [],
        // removeBuffer : [],
        remove1Buffer : [],
        remove2Buffer : [],
        remove3Buffer : [],
        gridBuffer : [],
        gridStep : 1,
        segmentInfoBuffer : [],
      }
      
      globalRecvData[msg.index].p5 = [];
      globalRecvData[msg.index].p5.push(JSON.parse(JSON.stringify(p5js_data)));  // deep copy
      globalRecvData[msg.index].p5.push(JSON.parse(JSON.stringify(p5js_data)));  
      globalRecvData[msg.index].p5.push(JSON.parse(JSON.stringify(p5js_data)));  
      globalRecvData[msg.index].subSourceIndex = 3;
      globalRecvData[msg.index].manualGridSwitch = false;
      
      update_image(msg.index);
      drawPlot();
      zipImageWithIndex(k);
      updateProgress();
    } else {
      remove_spinner(msg);
      notyf.error(`error ${msg.status} ${msg.error_msg}`);
    }
  }
});

socket.on("send start event", function (msg) {
  if (msg.sid == socket.id) {
    display_progress_info(msg.index, msg.filename, msg.reqid);
  }
});

socket.on("ping", function (msg) {
  socket.emit("pong", {
    // state: "alive",
    sid: socket.id,
    timestamp: getTimeStamp(),
    user: document.getElementById("username").innerText, 
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  });
});

socket.on("state", function (msg) {
  if (msg.sid == socket.id) {
    if (msg.state == "done") {
      uiButtonOn();
      notyf.success('Done');
    }
  }
});

socket.on('disconnect', function () {
  notyf.error('Server disconnected');
  
  const s1 = document.getElementById("serverIndicator");
  s1.classList.remove("server_on");
  s1.classList.add("server_off");
});

document.getElementById("files").onchange = function () {
  
  // total_images = 0 
  
  // if (customFiles == null) {
  //   customFiles = [...this.files]
  // }
  // console.log(this.files)
  // console.log(customFiles)
  
  for (let k = 0; k < this.files.length; k++) {
    const cExt = getExtension(this.files[k].name).toLowerCase();
    if (cExt == "jpg" || cExt == "jpeg" || cExt == "png") {
      // ok
    } else {
      // console.log(cExt);
      notyf.error(`지원하지 않는 확장자가 있습니다. <br/><b>jpg</b>, <br/><b>jpeg</b>, <br/><b>png</b> 만 지원합니다.`);
      return;
    }
  }
  
  if (customFiles == null) {
    customFiles = Array.from(document.getElementById("files").files);
    
    // 파일 이름으로 정렬
    customFiles.sort((file1, file2) => {
      return file1.name.localeCompare(file2.name);
    });
    
    document.getElementById("image_div").innerHTML = "";
    
    for (leg k = 0; k < customFiles.length; k++) {
      total_images = total_images + 1;
      
      let dc = document.createElement("div");
      let dcb = document.createElement("div");
      let dcm = document.createElement("div");
      dc.setAttribute("class", "col-12 mb-1");
      dcb.setAttribute("class", "card border-0 shadow components-section p-1");
      dcm.setAttribute("class", "card-body pb-0 pt-0 px-3");
      
      dcm.innerHTML = `
        <div class="row mb-1">
          <div class="col-8">
            <div class="row" style="height: 250px;">
              <div id="dRow${k}_1" class="col-4 d-flex justify-content-center align-items-center p-0 border-end" style="position: relative;">
                <a id="a${k}_1" class="custom_image" data-pswp-width="600" data-pswp-height="300" targe="_blank">
                  <img id="image${k}_1" class="custom_image fade-in-image" onload="document.getElementById('a${k}_1').setAttribute('data-pswp-width', this.naturalWidth); document,getElementById('a${k}_1').setAttribute('data-pswp-height, this.naturalHeight);">
                </a>
              </div>
              <div id="dRow${k}_2" class="col-4 d-flex justify-content-center align-items-center p-0 border-end" style="position: relative;">
              </div>
              <div id="dRow${k}_3" class="col-4 d-flex justify-content-center align-items-center p-0" style="position: relative;">
              </div>
            </div>
            <div class="row" style="height: 200px">
              <div id="dPlot${k}_1" class="col-4 p-0 border-end">
              </div>
              <div id="dPlot${k}_2" class="col-4 p-0 border-end">
              </div>
              <div id="dPlot${k}_3" class="col-4 p-0">
              </div>
            </div>
          </div>
          <div class="col-4">
            <div class="row">
              <div id="dRow${k}_4" class="col-12 p-0">
                <p id="p${k}_1" class="custom_p" style="margin-left: 20px;">
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-6 d-flex justify-content-center align-items-center p-0 border-end">
            <div id="cc${k}_1" class="custom_display">
              <img id="image${k}_scalebar">
            </div>
          </div>
          <div class="col-6 d-flex justify-content-center align-items-center p-0">
            <div id="cc${k}_2" class="custom_display" style="width:100%">
              <div class="row mb-1">
                <div class="col-4 d-flex align-items-center justify-content-end"><label class="mb-0">Scale</label></div>
                <div class="col-8 d-flex"><div class="input-group"><input type="number" class="form-control" id="manual_scale_${k}" min="0" /><span class="input-group-text">&#181;m</span></div></div>
              </div>
              <div class="row mb-1">
                <div class="col-4 d-flex align-items-center justify-content-end"><label class="mb-0">Scale Bar</label></div>
                <div class="col-8 d-flex">
                  <div class="input-group">
                    <input type="text" class="form-control" id="manual_scalebar_${k}" onclick="setScaleBar(${k})"/>
                  </div>
                </div>
              </div>
              <div class="row mb-1">
                <div class="col-4 d-flex"></div>
                <div class="col-8 d-flex">
                  <button class="btn btn-outline-success btn-sm" type="button" onclick="manualRun(${k})"><i class="fas fa-running"></i> Run</button>
                </div>
              </div>
            </div>
          </div>
        </div>`;
        
      dcb.appendChild(dcm);
      dc.appendChild(dcb);
      
      document.getElementById("image_div").appendChild(dc);
      
      let label_0 = document.createElement("span")
      label_0.setAttribute("style", "position: absolute; top: 0; left: 50%; transform: translateX(-50%); color: white; background-color: rgba(0, 0, 0, 0.5); padding: 5px; border-radius: 5px;")
      label_0.innerHTML = "Raw"
      document.getElementById(`a${k}_1`).append(label_0)
      
      let reader = new FileReader();
      
      reader.onload = function (e) {
        document.getElementById(`image${k}_1`).src = e.target.result;
        document.getElementById(`a${k}_1`).href = e.target.result;
      };
      
      reader.readAsDataURL(customFiles[k]);
    }
    
    if (document.getElementById("opt_autorun").checked == true) {
      document.getElementById("buttonRun").click();
    };
  } else {
    // console.log("add something...")  // #####################################
    window.scrollTo(0, document.body.scrollHeight);
    
    setTimeout(function() {
      const addFiles = Array.from(document.getElementById("files").files);
      
      // 파일 이름으로 정렬
      addFiles.sort((file1, file2) => {
        return file1.name.localeCompare(file2.name);
      });
      
      const currentImageCount = Object.keys(globalRecvData).length;
      customFiles = customFiles.concat(addFiles);
      
      for (let k = currentImageCount; k < customFiles.length; k++) {
        total_images = total_images + 1;
        
        let dc = document.createElement("div");
        let dcb = document.createElement("div");
        let dcm = document.createElement("div");
        dc.setAttribute("class", "col-12 mb-1");
        dcb.setAttribute("class", "card border-0 shadow components-section p-1");
        dcm.setAttribute("class", "card-body pb-0 pt-0 px-3");
        
        dcm.innerHTML = `
          <div class="row mb-1">
            <div class="col-8">
              <div class="row" style="height: 250px;">
                <div id="dRow${k}_1" class="col-4 d-flex justify-content-center align-items-center p-0 border-end" style="position: relative;">
                  <a id="a${k}_1" class="custom_image" data-pswp-width="600" data-pswp-height="300" targe="_blank">
                    <img id="image${k}_1" class="custom_image fade-in-image" onload="document.getElementById('a${k}_1').setAttribute('data-pswp-width', this.naturalWidth); document,getElementById('a${k}_1').setAttribute('data-pswp-height, this.naturalHeight);">
                  </a>
                </div>
                <div id="dRow${k}_2" class="col-4 d-flex justify-content-center align-items-center p-0 border-end" style="position: relative;">
                </div>
                <div id="dRow${k}_3" class="col-4 d-flex justify-content-center align-items-center p-0" style="position: relative;">
                </div>
              </div>
              <div class="row" style="height: 200px">
                <div id="dPlot${k}_1" class="col-4 p-0 border-end">
                </div>
                <div id="dPlot${k}_2" class="col-4 p-0 border-end">
                </div>
                <div id="dPlot${k}_3" class="col-4 p-0">
                </div>
              </div>
            </div>
            <div class="col-4">
              <div class="row">
                <div id="dRow${k}_4" class="col-12 p-0">
                  <p id="p${k}_1" class="custom_p" style="margin-left: 20px;">
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-6 d-flex justify-content-center align-items-center p-0 border-end">
              <div id="cc${k}_1" class="custom_display">
                <img id="image${k}_scalebar">
              </div>
            </div>
            <div class="col-6 d-flex justify-content-center align-items-center p-0">
              <div id="cc${k}_2" class="custom_display" style="width:100%">
                <div class="row mb-1">
                  <div class="col-4 d-flex align-items-center justify-content-end"><label class="mb-0">Scale</label></div>
                  <div class="col-8 d-flex"><div class="input-group"><input type="number" class="form-control" id="manual_scale_${k}" min="0" /><span class="input-group-text">&#181;m</span></div></div>
                </div>
                <div class="row mb-1">
                  <div class="col-4 d-flex align-items-center justify-content-end"><label class="mb-0">Scale Bar</label></div>
                  <div class="col-8 d-flex">
                    <div class="input-group">
                      <input type="text" class="form-control" id="manual_scalebar_${k}" onclick="setScaleBar(${k})"/>
                    </div>
                  </div>
                </div>
                <div class="row mb-1">
                  <div class="col-4 d-flex"></div>
                  <div class="col-8 d-flex">
                    <button class="btn btn-outline-success btn-sm" type="button" onclick="manualRun(${k})"><i class="fas fa-running"></i> Run</button>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
          
        dcb.appendChild(dcm)
        dc.appendChild(dcb)
        
        document.getElementById("image_div").appendChild(dc);
        
        let label_0 = document.createElement("span")
        label_0.setAttribute("style", "position: absolute; top: 0; left: 50%; transform: ttranslateX(-50%); color: white; background-color: rgba(0, 0, 0, 0.5); padding: 5px; border-radius: 5px;")
        label_0.innerHTML = "Raw"
        document.getElementById(`a${k}_1`).append(label_0)
        
        let reader = new FileReader();
        
        reader.onload = function (e) {
          document.getElementById(`image${k}_1`).src = e.target.result;
          document.getElementById(`a${k}_1`).href = e.target.result;
        };
        
        reader.readAsDataURL(customFiles[k]);
      }
      
      window.scrollBy(0, 500);
      
      if (document.getElementById("opt_autorun").checked == true) {
        second_run();
      };
      
    }, 300);
  }
};

document.getElementById("buttonRun").onclick = function () {
  
  // const files =Array.from(document.getElementById("files").files);
  
  // // 파일 이름으로 정렬
  // files.sort((file1, file2) => {
  //   return file1.name.localeCompare(file2.name);
  // });
  
  currentCommand = "RUN";
  const imageInput = document.getElementById("files");
  
  if (customFiles.length === 0) {
    notyf.error(`선택된 파일이 없습니다. 파일을 선택해주세요.`);
    return;
  }
  
  globalRecvData = {};
  
  let sendData = [];
  
  for (let k = 0; k < customFiles.length; k++) {
    sendData.push({ index: k, file: customFiles[k], filename: customFiles[k].name });
    display_spinner(k, customFiles[k].name);
  }
  
  uiButtonOff();
  updateProgress();
  
  const timeStamp = getTimeStamp();
  const userName = document.getElementById("username").innerText;
  
  let optScale = document.getElementById("opt_scale").value;
  
  if (isNaN(parseInt(optScale))) {
    optScale = null;
  } else {
    optScale = parseInt(optScale)
  }
  
  let manualScaleBar = [0, 0, 0, 0];
  try {
    if (document.getElementById(`opt_scalebar`).value != "") {
      manualScaleBar = document.getElementById(`opt_scalebar`).value.split(',')
    }
    
    if (isNaN(manualScaleBar[0])) {
      manualScaleBar = [0, 0, 0, 0];
    } else if (isNaN(manualScaleBar[1])) {
      manualScaleBar = [0, 0, 0, 0];
    } else if (isNaN(manualScaleBar[2])) {
      manualScaleBar = [0, 0, 0, 0];
    } else if (isNaN(manualScaleBar[3])) {
      manualScaleBar = [0, 0, 0, 0];
    }
  } catch (error) {
    console.error("ERROR", error);
    manualScaleBar = [0, 0, 0, 0];
  }
  
  socket.emit("recv image file", {
    msg: "send data",
    length: sendData.length,
    uid: socket.id,
    files: sendData,
    timestamp: timeStamp, 
    username: userName, 
    option_scale: optScale, 
    option_x0: manualScaleBar[0],
    option_y0: manualScaleBar[1],
    option_x1: manualScaleBar[2],
    option_y1: manualScaleBar[3],
    option_min_diameter_threshold: parseFloat(document.getElementById(`option_min_diameter_threshold`).value)
  });
};

function second_run() {
  
  currentCommand = "RUN";
  // const imageInput = document.getElementById("files");
  
  if (customFiles.length === 0) {
    notyf.error('선택된 파일이 없습니다. 파일을 선택해주세요.');
    return;
  }

  let sendData = [];
  const currentImageCount = Object.keys(globalRecvData).length;

  for (let k = currentImageCount; k < customFiles.length; k++) {
    // console.log(">>", k);
    sendData.push({ index: k, file: customFiles[k], filename: customFiles[k].name });
    display_spinner(k, customFiles[k].name);
  }

  uiButtonOff();
  updateProgress();

  const timeStamp = getTimeStamp();
  const userName = document.getElementById("username").innerText;

  let optScale = document.getElementById("opt_scale").value;

  if (isNaN(parseInt(optScale))) {
    optScale = null;
  } else {
    optScale = parseInt(optScale)
  }

  let manualScaleBar = [0, 0, 0, 0];
  try {
    if (document.getElementById(opt_scalebar).value != "") {
      manualScaleBar = document.getElementById(opt_scalebar).value.split(',')
    }
  
    if (isNaN(manualScaleBar[0])) {
      manualScaleBar = [0, 0, 0, 0];
      } else if (isNaN(manualScaleBar[1])) {
        manualScaleBar = [0, 0, 0, 0];
      } else if (isNaN(manualScaleBar[2])) {
        manualScaleBar = [0, 0, 0, 0];
      } else if (isNaN(manualScaleBar[3])) {
        manualScaleBar = [0, 0, 0, 0]; 
      } 
    } catch (error) {
      console.error("ERROR", error);
      manualScaleBar = [0, 0, 0, 0];
    }

  socket.emit("recv image file", {
    msg: "send data",
    length: sendData.length,
    uid: socket.id,
    files: sendData,
    timestamp: timeStamp,
    username: userName,
    option_scale: optScale,
    option_x0: manualScaleBar[0],
    option_y0: manualScaleBar[1],
    option_x1: manualScaleBar[2],
    option_y1: manualScaleBar[3],
    option_min_diameter_threshold: parseFloat(document.getElementById(opt_min_diameter_threshold).value)
  });
};

function manualRun(k, remove1Buff = [], remove2Buff = [], remove3Buff = []) {
  currentCommand = "RUN_Manual";
  // const imageInput = document.getElementById("files");
  
  let sendData = [];
  
  sendData.push({ index: k, file: customFiles[k], filename: customFiles[k].name });
  display_spinner(k, customFiles[k].name);
  
  const timeStamp = getTimeStamp();
  const userName = document.getElementById("username").innerText;
  
  // const optionColorMap = document.getElementById("opt_colormap");
  
  let optScale = document.getElementById(`manual_scale_${k}`).value;
  
  if (isNaN(parseInt(optScale))) {
    optScale = null;
  } else {
    optScale = parseInt(optScale)
  }
  
  let manualScaleBar = [0, 0, 0, 0];
  if (document.getElementById(`manual_scalebar_${k}`).value != "") {
    manualScaleBar = document.getElementById(`manual_scalebar_${k}`).value.split(',')
  }
  
  for (let t1 = 0 ; t1 < remove1Buff.length; t1++) {
    remove1Buff[t1] = [parseInt(remove1Buff[t1][0]) , parseInt(remove1Buff[t1][1])]
  }
  
  for (let t2 = 0 ; t2 < remove2Buff.length; t2++) {
    remove2Buff[t2] = [parseInt(remove2Buff[t2][0]) , parseInt(remove2Buff[t2][1])]
  }
  
  for (let t3 = 0 ; t3 < remove3Buff.length; t3++) {
    remove3Buff[t3] = [parseInt(remove3Buff[t3][0]) , parseInt(remove3Buff[t3][1])]
  }
  
  socket.emit("recv image file", {
    msg: "send data",
    length: sendData.length,
    uid: socket.id,
    files: sendData,
    timestamp: timeStamp,
    username: userName,
    option_scale: optScale,
    option_x0: manualScaleBar[0],
    option_y0: manualScaleBar[1],
    option_x1: manualScaleBar[2],
    option_y1: manualScaleBar[3],
    option_min_diameter_threshold: parseFloat(document.getElementById(`opt_min_diameter_threshold`).value)
  });
};

function updateProgress() {
  const element = document.getElementById("indicatorProgress");
  
  const processedImage = Object.keys(globalRecvData).length;
  
  element.innerHTML = `${processedImage} / ${total_images}`;
}

function uiButtonOn() {
  const b0 = document.getElementById("files");
  b0.disabled = false;
  // b0.classList.remove("btn-gray-200");
  // b0.classList.add("btn-outline-danger");
  
  const b1 = document.getElementById("buttonRun");
  b1.disabled = false;
  b1.classList.remove("btn-gray-200");
  b1.classList.add("btn-outline-danger");
  
  const b2 = document.getElementById("buttonCsvDetail");
  b2.disabled = false;
  b2.classList.remove("btn-gray-200");
  b2.classList.add("btn-outline-info");
  
  const b3 = document.getElementById("buttonCsv");
  b3.disabled = false;
  b3.classList.remove("btn-gray-200");
  b3.classList.add("btn-outline-info");
  
  const b4 = document.getElementById("buttonPdf");
  b4.disabled = false;
  b4.classList.remove("btn-gray-200");
  b4.classList.add("btn-outline-info");

  const b5 = document.getElementById("buttonImg1");
  b5.disabled = false;
  b5.classList.remove("btn-gray-200");
  b5.classList.add("btn-outline-info");

  // const b6 = document.getElementById("buttonAdd");
  // b6.disabled = false;
  // b6.classList.remove("btn-gray-200");
  // b6.classList.add("btn-outline-info");
}

function uiButtonOff() {
  const b0 = document.getElementById("files");
  b0.disabled = true;
  // b0.classList.remove("btn-outline-danger")
  // b0.classList.add("btn-gray-200");
  
  const b1 = document.getElementById("buttonRun");
  b1.disabled = true;
  b1.classList.remove("btn-outline-danger")
  b1.classList.add("btn-gray-200");
  
  const b2 = document.getElementById("buttonCsvDetail");
  b2.disabled = true;
  b2.classList.remove("btn-outline-info");
  b2.classList.add("btn-gray-200");
  
  const b3 = document.getElementById("buttonCsv");
  b3.disabled = true;
  b3.classList.remove("btn-outline-info");
  b3.classList.add("btn-gray-200");
  
  const b4 = document.getElementById("buttonPdf");
  b4.disabled = true;
  b4.classList.remove("btn-outline-info");
  b4.classList.add("btn-gray-200");
  
  const b5 = document.getElementById("buttonImg1");
  b5.disabled = true;
  b5.classList.remove("btn-outline-info");
  b5.classList.add("btn-gray-200");
  
  // const b6 = document.getElementById("buttonAdd");
  // b6.disabled = true;
  // b6.classList.remove("btn-outline-info");
  // b6.classList.add("btn-gray-200");
}

function display_spinner(k, name) {
  document.getElementById(`p${k}_1`).innerHTML = `<div class="" style="color: #a50034;">
              <span style="font-size: 16px">${name}</span><br/>
              <span class="loader"></span><br/>
              <span style="font-size: 16px">분석 대기중입니다.</span>
              </div>`;
  document.getElementById(`dRow${k}_2`).innerHTML = "";
  document.getElementById(`dRow${k}_3`).innerHTML = "";
  
  document.getElementById(`dPlot${k}_1`).innerHTML = "";
  document.getElementById(`dPlot${k}_2`).innerHTML = "";
  document.getElementById(`dPlot${k}_3`).innerHTML = "";
}

function display_progress_info(k, name, reqid) {
  document.getElementById(`p${k}_1`).innerHTML = <div class="" style="color: #a50034;">
              <span style="font-size: 16px">${reqid}</span><br/>
              <span style="font-size: 16px">${name}</span><br/>
              <span class="loader"></span><br/>
              <span id="typed_element" style="font-size: 16px"></span>
              </div>;
  document.getElementById(`dRow${k}_2`).innerHTML = "";
  document.getElementById(`dRow${k}_3`).innerHTML = "";
  
  setTimeout(function () {
    let typed = new Typed('#typed_element', {
      strings: ["분석이 진행 중입니다. <br/>조금만 기다려 주세요.",
                "이 작업이 조금 시간이 걸릴 거예요, <br/>이미지당 대략 100초 정도 예상하고 있습니다.",
                "지금 열심히 분석하고 있습니다.",
                "조금만 더 기다려 주시겠어요?",
                // "분석가님! <br/>.........<br/> 사랑합니다. ♥♥♥",
                // "분석가님! <br/>오늘 특별히 더 멋지신것 같습니다.",
                // "아.... <br/>색칠하는데 물감을 다썼네요. 어쩌죠?",
                // "분석가님! <br/>저는 서버지만 곱창전골을 좋아합니다. <br/>시간되시면 저좀 사주세요!",
                // "분석가님! <br/>아름다우시네요!",
                "분석이 진행되는 동안, <br/>차 한잔 하시는 건 어떨까요?",

                "분석가님의 이미지를 신중하게 분석 중입니다. <br/>잠시만 기다려 주세요.",
                "분석 중입니다. <br/>지금, 방금, 잠깐사이에 지구는 약 30킬로미터를 이동했답니다.",
                "우리 서버가 분석가님의 데이터로 바쁘네요. <br/>결과가 곧 나올 것 같아요.",
                "분석이 거의 마무리되고 있습니다. <br/>최상의 결과를 드리기 위해 노력 중입니다.",
                "분석가님의 데이터를 특별한 과정으로 변환 중이에요. <br/>곧 멋진 결과를 보실 수 있을 거예요.",
                "재미있는 사실: <br/>나비는 발로 맛을 봅니다. <br/>신기하죠?",
                "분석가님이 이 메시지를 읽는 동안에도, <br/>우리는 분석가님의 결과를 위해 열심히 작업 중입니다.",
                "분석을 기다리는 동안, 잠시 밖을 바라보세요. <br/>자연은 항상 놀라움을 준비하고 있어요.",
                // "사람은 하루에 평균 15번 웃는다고 합니다. <br/>오늘 분석가님은 몇 번이나 웃으셨나요?",
                "분석에 조금 시간이 필요해요. 조금만 기다려주실래요? <br/>어서 좋은 결과로 돌아올게요.",
                
                "데이터 분석 중인데, <br/>잠시 시간을 내서 함께 기다리면 어떨까요? <br/>곧 좋은 소식을 전할 수 있을 거예요.",
                "분석이 조금 복잡해서 시간이 걸리고 있어요. <br/>하지만 최선을 다하고 있으니, <br/>조금만 더 기다려 주세요.",
                "결과가 나오기까지 잠시만 더 기다리시겠어요? <br/>최상의 결과를 위해 노력 중입니다.",
                "분석이 마무리 단계에 접어들었어요. <br/>조금만 기다리시면, 곧 결과를 공유할 수 있을 거예요.",
                // "분석가님! <br/>저는 서버지만 삼겹살을 무척이나 좋아합니다. <br/>시간되시면 저좀 사주세요!",
                "조금만 기다리시면, 분석 결과를 바로 알려드릴 수 있을 거예요. <br/>분석가님의 인내심에 감사드립니다.",
                "분석이 거의 끝나가고 있어요. <br/>분석가님의 소중한 데이터에 최선을 다해 작업 중이니, <br/>조금만 더 기다려 주세요.",
                "이해해 주셔서 감사해요. <br/>분석 과정이 약간 시간이 걸리긴 하지만, <br/>곧 좋은 소식을 전할 수 있을 거예요.",
                "분석을 위해 조금 더 시간을 달라고 부탁드리고 싶어요. <br/>분석가님의 기다림에 보답할 수 있도록 최선을 다하고 있습니다.",
                // "이 아무말 대잔치가 빨리 끝났으면 좋겠네요. <br/>우리 서버 좀더 달려 !",
                
                "AI 토막상식:<br/>LLM(Large Language Model)은 수십억 개의 파라미터로 구성된 거대 인공신경망 모델입니다.",
                "AI 토막상식:<br/>강화학습은 행동의 결과로 보상을 받아 최적의 방법을 찾아가는 AI 학습 방식이에요.",
                "AI 토막상식:<br/>전이학습은 기존 딥러닝 모델을 재활용하여 새로운 작업에 적용하는 AI 기술이에요.",
                "AI 토막상식:<br/>제너레이티브 AI가 급부상하며 이미지, 음성, 텍스트 등 다양한 콘텐츠 생성에 활용되고 있습니다.",
                "AI 토막상식:<br/>AI와 사람 간 상호작용을 위한 멀티모달 AI 기술이 각광받고 있습니다.",
                "AI 토막상식:<br/>멀티모달이란 이미지, 텍스트, 오디오 등 다양한 유형의 데이터를 동시에 처리하고 융합하는 기술입니다.",
                "AI 토막상식:<br/>설명 가능한 AI는 AI 판단 근거를 설명하여 투명성을 높이는 기술을 의미합니다.",
                "AI 토막상식:<br/>최근 모든곳에 쓰이는 트랜스포머는 어텐션 메커니즘을 사용하여 입력 시퀀스를 다른 시퀀스로 변환하는 신경망 모델입니다.",
                "AI 토막상식:<br/>프롬프트 엔지니어링은 원하는 결과를 얻기 위해 생성형 AI 모델에게 명령어와 지침을 글로써 제공하는 기술입니다.",
                "AI 토막상식:<br/>CNN(Convolutional Neural Network)은 이미지 처리에 특화된 딥러닝 모델입니다.",
                
                "IT 토막상식:<br/>가상현실(VR)은 실제와 유사한 3D 환경을 컴퓨터로 구현하는 기술을 말합니다.",
                "IT 토막상식:<br/>증강현실(AR)은 현실 세계에 가상 정보를 겹쳐서 보여주는 기술이죠.",
                "IT 토막상식:<br/>사물인터넷(IoT)은 사물에 센서를 부착하여 정보를 수집하고 공유하는 기술이에요.",
                "IT 토막상식:<br/>디지털 트윈은 현실 세계의 사물이나 시스템을 가상으로 복제하는 기술입니다. 이를 통해 현실에서 하기 힘든 실험을 가상의 환경에서 해볼 수 있습니다.",
                "IT 토막상식:<br/>RPA(Robotic Process Automation)는 반복적인 업무를 소프트웨어로 자동화하는 기술이에요.",
                "IT 토막상식:<br/>DevOps는 개발과 운영을 통합하여 소프트웨어를 신속하게 제공하는 실무 문화를 뜻합니다.",
                "IT 토막상식:<br/>파이썬은 1989년 귀도 반 로섬이 개발한 프로그래밍 언어로서, 배우기 쉽고 다양한 분야에 활용 가능하여 현재 가장 인기 있는 프로그래밍 언어 중 하나입니다.",
                "IT 토막상식:<br/>분석가님. 정규표현식을 알면 인생이 3배 편해집니다.",
                "IT 토막상식:<br/>리눅스는 1991년 리누스 토발즈가 개발한 유닉스 계열 운영 체제이며, 현재 오픈 소스 소프트웨어로 가장 성공적인 사례 중 하나입니다.",
                "IT 토막상식:<br/>분석가님이 매일 쓰시는 인터넷은 1969년 미국 국방부의 프로젝트 ARPANet에서 시작되었습니다.",
                
                "AI 토막상식:<br/>인공지능(AI)은 인간의 지적 능력을 모방하거나 확장하여 기계나 프로그램에 구현하는 기술로, 머신러닝, 딥러닝, 자연어 처리, 컴퓨터 비전 등 다양한 분야를 포함합니다.",
                "AI 토막상식:<br/>AI 기술의 발전으로 인해 광고, 금융, 의료, 교통, 국방 등 다양한 산업 분야에서 AI 활용 사례가 늘어나고 있으며, 이는 업무 효율성 향상과 새로운 가치 창출로 이어질 것으로 기대됩니다.",
                "AI 토막상식:<br/>머신러닝은 AI의 주요 분야로, 대량의 데이터를 기반으로 패턴을 학습하고 미래를 예측하는 기술입니다. 이를 통해 AI 시스템은 지속적인 학습과 성능 개선이 가능합니다.",
                "AI 토막상식:<br/>딥러닝은 머신러닝의 한 분야로, 인공신경망을 활용하여 데이터로부터 복잡한 패턴을 자동으로 학습하고 추론하는 기술입니다. 컴퓨터 비전, 음성 인식 등 다양한 분야에 활용되고 있습니다.",
                "AI 토막상식:<br/>자연어 처리(NLP)는 인간의 언어를 컴퓨터가 이해하고 해석할 수 있도록 하는 AI 기술로, 채팅봇, 기계 번역, 감성 분석 등 다양한 응용 분야가 있습니다.",
                "AI 토막상식:<br/>컴퓨터 비전은 이미지나 동영상으로부터 물체, 장면, 활동 등을 인식하고 해석하는 AI 기술로, 자율주행차, 보안 시스템, 의료 영상 분석 등에 활용됩니다.",
                "AI 토막상식:<br/>AI는 대규모 데이터 처리 및 빠른 의사결정이 필요한 분야에서 유용하며, 인간의 편향이나 오류를 최소화할 수 있는 장점이 있습니다.",
                "AI 토막상식:<br/>전문가 시스템은 인간 전문가의 지식과 경험을 모방하여 구현한 AI 시스템으로, 특정 분야의 문제 해결을 돕는 데 활용될 수 있습니다.",
                "AI 토막상식:<br/>퍼지 논리는 불확실성과 모호성을 처리할 수 있는 AI 기술로, 인간의 추론 방식을 모방하여 설계되었습니다. 제어 시스템, 의사결정 지원 등에 활용 가능합니다.",
                "AI 토막상식:<br/>AI는 감성 인식, 대화 시스템, 행동 모방 등의 기술 발전으로 인간과 더욱 유사한 방식의 상호작용이 가능해지고 있습니다.",
                "AI 토막상식:<br/>AI는 사물 인터넷(IoT), 로봇 공학, 가상/증강 현실 등 다양한 기술과 융합되어 새로운 응용 분야를 창출하고 있습니다.",
                "AI 토막상식:<br/>인공지능 윤리는 AI 시스템의 공정성, 투명성, 설명 가능성 등을 다루는 분야로, AI가 인간 사회에 미치는 영향을 고려하는 것이 중요합니다.",
                "AI 토막상식:<br/>AI가 발전함에 따라 일자리 대체 및 새로운 일자리 창출 등 노동시장에 미치는 영향에 대한 우려와 기대가 공존하고 있습니다.",
                "AI 토막상식:<br/>AI 시스템의 편향과 차별 문제를 해결하기 위해 다양성과 포용성을 갖춘 데이터 및 알고리즘 개발이 필요합니다.",
                "AI 토막상식:<br/>AI와 관련된 개인정보 보호, 데이터 프라이버시, 보안 등의 이슈가 대두되면서 이에 대한 규제와 가이드라인 마련이 요구되고 있습니다.",
                "AI 토막상식:<br/>AI 기술 개발을 위해서는 방대한 양의 데이터 확보와 고성능 컴퓨팅 자원이 필수적이며, 이를 위한 기술 인프라 구축이 중요합니다.",
                "AI 토막상식:<br/>AI 인재 양성을 위한 교육 혁신 및 다학제간 융합 연구가 활발히 이루어지고 있으며, AI 전문가 수요가 지속적으로 증가할 전망입니다.",
                "AI 토막상식:<br/>AI는 지능형 개인 비서, 가상 에이전트 등 인간-AI 협업 시스템의 형태로 발전하고 있으며, 인간과 기계의 상호작용 방식에 변화를 가져올 것입니다.",
                "AI 토막상식:<br/>AI는 의사결정 지원, 최적화, 예측, 위험 관리 등 다양한 분야에서 활용되어 기업의 효율성과 경쟁력 제고에 기여할 수 있습니다.",
                "AI 토막상식:<br/>헬스케어 분야에서 AI는 의료 영상 분석, 질병 진단, 신약 개발, 건강 모니터링 등 다양한 용도로 활용되어 의료 서비스 개선에 기여할 것으로 기대됩니다.",
                "AI 토막상식:<br/>교육 분야에서 AI는 학습 분석, 개인화된 학습 경험 제공, 학생 평가 및 피드백 등을 통해 교육 혁신을 가져올 수 있습니다.",
                "AI 토막상식:<br/>AI는 자연재해 예측, 기후 변화 모니터링, 에너지 최적화 등 환경 문제 해결에 활용되어 지속가능한 발전에 기여할 수 있습니다.",
                "AI 토막상식:<br/>AI 기반 추천 시스템은 개인화된 서비스를 제공하여 고객 만족도를 높이고, 데이터 분석을 통한 맞춤형 마케팅이 가능해집니다.",
                "AI 토막상식:<br/>금융 분야에서 AI는 위험 관리, 투자 분석, 사기 탐지, 고객 상담 등 다양한 영역에서 활용되어 금융 서비스의 효율성과 안전성을 높일 수 있습니다.",
                "AI 토막상식:<br/>법률 분야에서 AI는 대량의 문서 검토, 증거 분석, 판례 예측 등을 지원하여 변호사의 업무 효율성을 높이는 데 기여할 수 있습니다.",
                "AI 토막상식:<br/>AI는 창의성과 혁신을 촉진하는 도구로 활용될 수 있으며, 새로운 아이디어와 솔루션 개발에 도움을 줄 수 있습니다.",
                "AI 토막상식:<br/>AI는 복잡한 문제를 해결하고 최적의 솔루션을 제시할 수 있으며, 인간 전문가의 의사결정을 보조하고 생산성을 향상시킬 수 있습니다.",
                "AI 토막상식:<br/>AI와 인간의 협력은 상호 보완적인 역할을 통해 시너지 효과를 낼 수 있으며, 이를 통해 더 나은 성과를 거둘 수 있습니다.",
                "AI 토막상식:<br/>AI는 실시간 데이터 처리 및 동적 의사결정이 필요한 분야에서 특히 유용하며, 위험하거나 반복적인 작업을 자동화하여 인간의 노력을 절감시킬 수 있습니다.",
                "AI 토막상식:<br/>AI 기술은 지속적인 연구와 개발을 통해 더욱 발전할 것으로 예상되며, 새로운 비즈니스 모델과 산업의 탄생을 가져올 것입니다.",
                "AI 토막상식:<br/>AI의 발전은 과학 연구, 우주 탐사, 신소재 개발 등 첨단 분야에서 새로운 발견을 가능하게 하고 혁신을 가속화할 수 있습니다.",
                "AI 토막상식:<br/>AI는 재해 대응, 긴급 구조, 군사 작전 등 위험한 상황에서 활용되어 인명 구조와 안전을 지원할 수 있습니다.",
                "AI 토막상식:<br/>AI는 농업, 식품 생산, 공급망 관리 등 식품 산업 전반에 걸쳐 활용될 수 있으며, 생산성 향상과 식품 안전성 제고에 기여할 수 있습니다.",
                "AI 토막상식:<br/>교통 및 물류 분야에서 AI는 교통 관리, 최적 배송 경로 계획, 수요 예측 등에 활용되어 효율성과 안전성을 높일 수 있습니다.",
                "AI 토막상식:<br/>스포츠 산업에서 AI는 경기 분석, 전술 계획 수립, 선수 건강 관리 등을 지원하여 팀과 선수의 성과 향상에 기여할 수 있습니다.",
                "AI 토막상식:<br/>언어 기술 분야에서 AI는 기계 번역, 음성 인식 및 합성, 대화 시스템 등 다양한 응용 프로그램에 활용되고 있습니다.",
                "AI 토막상식:<br/>엔터테인먼트 산업에서 AI는 가상 현실, 증강 현실, 게임 개발 등에 적용되어 새로운 경험을 제공할 수 있습니다.",
                "AI 토막상식:<br/>AI는 사이버 보안 분야에서 이상 탐지, 위협 예측, 대응 등을 통해 보안 강화에 기여할 수 있습니다.",
                "AI 토막상식:<br/>로봇 공학과 AI 기술의 융합을 통해 지능형 로봇이 개발되고 있으며, 이는 제조업, 서비스업 등 다양한 산업에 적용될 수 있습니다.",
                "AI 토막상식:<br/>AI는 인간과의 상호작용을 개선하고 의사소통을 용이하게 하여 사용자 경험을 향상시킬 수 있습니다.",
                "AI 토막상식:<br/>편향과 차별 없는 공정한 AI 시스템 개발을 위해서는 다양성과 포용성을 갖춘 데이터 및 알고리즘이 필수적입니다.",
                "AI 토막상식:<br/>AI 시스템의 투명성과 설명 가능성 확보를 위한 기술 개발이 요구되며, 이를 통해 신뢰성과 책임성을 높일 수 있습니다.",
                "AI 토막상식:<br/>AI 기술의 발전과 더불어 이에 대한 규제와 가이드라인 마련이 필요하며, 이를 통해 AI 기술의 안전성과 윤리성을 확보할 수 있습니다.",
                "AI 토막상식:<br/>AI 기술의 발전으로 인한 일자리 변화에 대비하여 교육 및 직업 훈련 프로그램의 혁신이 필요합니다.",
                "AI 토막상식:<br/>AI 기술은 장애인, 고령자 등 취약 계층을 돕는 데 활용될 수 있으며, 이를 통해 사회적 포용성을 높일 수 있습니다.",
                "AI 토막상식:<br/>AI 시스템의 편향과 차별 문제를 해결하기 위해서는 AI 개발 과정에서 다양한 관점과 가치관을 반영해야 합니다.",
                "AI 토막상식:<br/>AI 기술은 과학 연구, 우주 탐사, 신소재 개발 등 첨단 분야에서 새로운 발견과 혁신을 가속화할 수 있습니다.",
                "AI 토막상식:<br/>AI는 인간의 창의성과 직관력을 보완하고 새로운 아이디어와 솔루션 개발을 지원할 수 있습니다.",
                "AI 토막상식:<br/>AI 기술은 지속가능한 발전과 환경 보호를 위해 에너지 효율성 향상, 자원 관리 최적화 등에 활용될 수 있습니다.",
                "AI 토막상식:<br/>AI는 개인화된 서비스와 맞춤형 경험을 제공하여 고객 만족도를 높이고 기업의 경쟁력을 강화할 수 있습니다.",
                "AI 토막상식:<br/>AI 기술은 기존 산업의 혁신과 새로운 비즈니스 모델 창출을 촉진하여 경제 성장에 기여할 수 있습니다.",
                "AI 토막상식:<br/>AI 시스템의 설계 및 개발 과정에서 윤리적 원칙과 가치관을 고려하는 것이 중요합니다.",
                "AI 토막상식:<br/>AI 기술은 인간의 삶의 질 향상과 편의성 증진에 기여할 수 있지만, 동시에 프라이버시 침해 등의 우려도 존재합니다.",
                "DX 토막상식:<br/>DX란 디지털 기술을 활용하여 기업의 운영방식, 비즈니스 모델, 제품 및 서비스를 혁신적으로 변화시키는 것을 의미합니다.",
                "DX 토막상식:<br/>DX는 단순한 기술 도입이 아닌 기업 전략, 문화, 프로세스 등 전반적인 변화를 수반하는 패러다임 전환입니다.",
                "DX 토막상식:<br/>DX의 목적은 고객 경험 향상, 운영 효율성 제고, 새로운 수익원 창출 등입니다.",
                "DX 토막상식:<br/>DX를 통해 기업은 데이터 기반 의사결정과 민첩성을 높일 수 있습니다.",
                "DX 토막상식:<br/>DX 전략 수립 시 비즈니스 목표, 고객 니즈, 기술 동향 등을 고려해야 합니다.",
                "DX 토막상식:<br/>DX를 위해 클라우드, 모바일, 빅데이터, AI, IoT 등 디지털 기술을 활용해야 합니다.",
                "DX 토막상식:<br/>DX는 기업의 경쟁력 강화와 지속가능한 성장을 위한 필수 과제로 인식됩니다.",
                "DX 토막상식:<br/>DX는 기업 내부뿐 아니라 공급망, 파트너사, 고객 등 가치사슬 전반에 영향을 미칩니다.",
                "DX 토막상식:<br/>DX를 통해 고객 중심 비즈니스 모델로 전환하고 고객 경험을 개선할 수 있습니다.",
                "DX 토막상식:<br/>DX는 새로운 제품/서비스 개발, 신규 시장 진출 등의 기회를 제공합니다.",
                "DX 토막상식:<br/>DX를 위해서는 데이터 분석, 디지털 마케팅, 사이버 보안 등 디지털 역량이 필수적입니다.",
                "DX 토막상식:<br/>DX 과정에서 기존 조직문화와 프로세스를 혁신하는 것이 중요한 과제입니다.",
                "DX 토막상식:<br/>DX 추진을 위해 최고경영진의 강력한 리더십과 실행력이 요구됩니다.",
                "DX 토막상식:<br/>DX는 기업 내 모든 부서와 직원의 참여와 협력을 필요로 합니다.",
                "DX 토막상식:<br/>DX를 위해서는 장기적 관점의 지속적인 투자와 노력이 필요합니다.",
                "DX 토막상식:<br/>DX 성공의 관건은 디지털 인재 확보, 디지털 문화 정착 등입니다.",
                "DX 토막상식:<br/>DX를 통해 업무 프로세스 자동화와 효율성 향상이 가능합니다.",
                "DX 토막상식:<br/>DX는 실시간 데이터 분석과 통찰력 확보로 의사결정을 지원합니다.",
                "DX 토막상식:<br/>DX를 통해 제품/서비스 혁신 주기를 단축하고 신속 출시가 가능해집니다.",
                "DX 토막상식:<br/>제조업의 DX는 스마트팩토리, 자동화, 예측 유지보수 등의 형태입니다.",
                "DX 토막상식:<br/>금융업의 DX는 디지털뱅킹, 핀테크 서비스, AI 투자자문 등을 포함합니다.",
                "DX 토막상식:<br/>유통/물류 분야의 DX는 전자상거래, 옴니채널, 자동화 물류센터 구축 등입니다.",
                "DX 토막상식:<br/>헬스케어 DX는 원격진료, 모바일헬스케어, 정밀의료 등을 의미합니다.",
                "DX 토막상식:<br/>DX를 통해 실시간 공급망 가시성과 민첩성을 확보할 수 있습니다.",
                "DX 토막상식:<br/>중소기업도 DX를 통해 기술혁신과 새 사업기회를 모색할 수 있습니다.",
                "DX 토막상식:<br/>DX는 산업 간 융합과 새로운 생태계 형성을 촉진할 것입니다.",
                "DX 토막상식:<br/>DX 시대에는 데이터 보안과 개인정보 보호 이슈에 주의를 기울여야 합니다.",
                "DX 토막상식:<br/>DX는 업무환경 변화, 직무 재설계 등 인력관리 측면의 변화를 수반합니다.",
                "DX 토막상식:<br/>DX로 인해 제품수명주기 단축, 시장변화 가속화 등 불확실성이 증가합니다.",
                "DX 토막상식:<br/>DX 혁신 지속을 위해서는 민첩한 조직문화와 유연한 거버넌스가 필요합니다.",
                "DX 토막상식:<br/>DX 추진 시 구성원들의 디지털 리터러시 역량 강화가 중요합니다.",
                "DX 토막상식:<br/>DX 전략 수립 시 기업의 현 수준에 대한 정확한 진단이 선행되어야 합니다.",
                "DX 토막상식:<br/>DX는 단순 자동화가 아닌 비즈니스 모델 혁신을 지향해야 합니다.",
                "DX 토막상식:<br/>DX 추진 시 단계별 우선순위를 설정하고 핵심과제에 집중해야 합니다.",
                "DX 토막상식:<br/>DX를 위해서는 데이터 통합 및 상호운용성 확보가 필수적입니다.",
                "DX 토막상식:<br/>DX를 통해 디지털 제품/서비스를 위한 새로운 수익모델을 창출할 수 있습니다.",
                "DX 토막상식:<br/>DX를 위해서는 유연하고 민첩한 기업문화와 변화관리가 매우 중요합니다.",
                "DX 토막상식:<br/>DX 과정에서 기존 업무프로세스 재설계와 최적화가 필요합니다.",
                "DX 토막상식:<br/>DX를 통해 새로운 협력모델과 생태계를 구축할 수 있습니다.",
                "DX 토막상식:<br/>DX 성과 측정을 위한 KPI와 평가체계 수립이 필요합니다.",
                "DX 토막상식:<br/>DX 성공을 위해서는 지속적 학습과 역량개발이 요구됩니다.",
                "DX 토막상식:<br/>DX는 파트너사, 공급업체 등과의 협업을 통해 실현될 수 있습니다.",
                "DX 토막상식:<br/>규모가 작을수록 DX를 통한 민첩성과 혁신역량 확보가 더욱 중요해집니다.",
                "DX 토막상식:<br/>DX를 위해서는 리더십, 문화, 인재 등 다차원적 접근이 필요합니다.",
                "DX 토막상식:<br/>DX를 위해서는 실험과 혁신을 장려하는 기업문화가 뒷받침되어야 합니다.",
                "DX 토막상식:<br/>DX를 통해 고객데이터를 활용하면 개인화된 고객경험을 제공할 수 있습니다.",
                "DX 토막상식:<br/>DX 추진 시 데이터 주도적 의사결정과 데이터 기반 운영이 매우 중요해집니다.",
                "DX 토막상식:<br/>DX를 통해 디지털 기술 기반의 제품/서비스 혁신이 가능해집니다.",
                "DX 토막상식:<br/>DX 추진 시 낮은 수준 혁신이 아닌 근본적 혁신을 목표로 해야 합니다.",
                "DX 토막상식:<br/>기업은 DX를 이끌 리더와 추진조직을 갖추어야 합니다.",
                "DX 토막상식:<br/>DX를 통해 비즈니스 민첩성을 높이고 시장변화에 신속히 대응할 수 있습니다.",
                "DX 토막상식:<br/>DX 과정에서 내부 역량과 외부 기술을 모두 활용해야 합니다.",
                "DX 토막상식:<br/>DX 추진 시 기업문화와 가치관 변화를 병행하지 않으면 지속가능하지 않습니다.",
                "DX 토막상식:<br/>DX를 통한 혁신은 고객경험 개선, 효율성 제고, 새로운 가치창출 등의 기회를 제공합니다.",
                "DX 토막상식:<br/>DX는 기술활용 그 이상의 새로운 비즈니스 모델과 운영방식 창출이 필요합니다.",
                "DX 토막상식:<br/>DX 과정의 데이터/보안 이슈에 대한 대응체계를 갖추어야 합니다.",
                "DX 토막상식:<br/>DX는 기업이 직면한 문제 해결과 새로운 기회 창출의 방안입니다.",
                "DX 토막상식:<br/>DX 실행 시 구성원들의 디지털 리터러시와 역량을 제고해야 합니다.",
                "DX 토막상식:<br/>DX를 통해 데이터 기반 의사결정과 예측분석이 가능해집니다.",
                "DX 토막상식:<br/>DX를 위해서는 내부 디지털역량을 지속적으로 강화해야 합니다.",
                "DX 토막상식:<br/>DX 과정에서 실험과 혁신을 장려하는 문화조성이 필수적입니다.",
                "DX 토막상식:<br/>DX는 제품/서비스 혁신 넘어 새로운 가치사슬과 생태계 창출을 지향합니다.",
                "DX 토막상식:<br/>DX를 통해 고객니즈 변화에 민첩히 대응하고 개인화 서비스를 제공할 수 있습니다.",
                "DX 토막상식:<br/>DX 추진 시 단기 성과보다 장기적 관점의 지속가능한 변화를 추구해야 합니다.",
                "DX 토막상식:<br/>DX는 기술혁신 뿐만 아니라 비즈니스 프로세스 및 운영모델 혁신을 수반합니다.",
                "DX 토막상식:<br/>DX 추진 시 시행착오와 실패를 두려워하지 말고 학습기회로 삼아야 합니다.",
                "DX 토막상식:<br/>DX 과정에서 구성원 디지털역량 개발과 변화관리가 매우 중요합니다.",
                "DX 토막상식:<br/>DX는 기존 산업경계를 허물고 새 비즈니스 기회를 창출할 수 있습니다.",
                "DX 토막상식:<br/>DX를 통해 고객중심 사고방식과 가치를 내재화할 수 있습니다.",
                "DX 토막상식:<br/>성공적 DX를 위해 최고경영진의 확고한 의지와 지원이 필수적입니다.",
                "DX 토막상식:<br/>DX 추진 시 기술에만 집중하기보다 비즈니스 전략과의 연계가 중요합니다.",
                "DX 토막상식:<br/>DX를 통해 데이터 기반 인사이트를 확보하고 새 비즈니스 기회를 모색할 수 있습니다.",
                "DX 토막상식:<br/>DX는 기업내부 혁신뿐 아니라 산업 전반의 생태계 변화를 이끌어낼 수 있습니다.",
                "DX 토막상식:<br/>DX 추진을 위해 기업의 디지털 성숙도를 정기적으로 평가, 개선해야 합니다.",
                "DX 토막상식:<br/>DX를 통해 실시간 데이터분석과 의사결정이 가능해지므로 민첩성이 높아집니다.",
                "DX 토막상식:<br/>DX는 제품/서비스 혁신 넘어 새로운 가치창출 모델 발굴이 가능해집니다.",
                "DX 토막상식:<br/>DX 과정에서 데이터 거버넌스와 보안정책 수립이 중요한 과제입니다.",
                "DX 토막상식:<br/>DX 성공을 위해서는 기업문화의 디지털 전환이 병행되어야 합니다.",
                "DX 토막상식:<br/>DX는 비즈니스모델 혁신의 필수조건이자 지속성장을 위한 전략입니다.",
                "DX 토막상식:<br/>DX를 통해 빠른 의사결정과 시장 대응력을 갖출 수 있습니다.",
                "DX 토막상식:<br/>DX는 기업의 디지털 역량 강화와 경쟁력 제고에 기여합니다.",
                "DX 토막상식:<br/>DX 추진 시 기업은 파트너사와 긴밀히 협력해야 합니다.",
                "DX 토막상식:<br/>DX는 기존 가치사슬을 재정의하고 새로운 비즈니스 기회를 창출합니다.",
                "DX 토막상식:<br/>DX 과정에서 기업은 민첩성과 혁신을 저해하는 장애요인을 제거해야 합니다.",
                "DX 토막상식:<br/>DX는 단기 수익보다 장기 지속가능성에 초점을 맞추어야 합니다.",
                "DX 토막상식:<br/>성공적 DX를 위해서는 구성원들의 적극적인 참여와 동기부여가 중요합니다.",
                "DX 토막상식:<br/>DX는 기업의 위험관리 역량을 높이고 미래 불확실성에 대비할 수 있게 합니다.",
                "DX 토막상식:<br/>DX 성공을 위해서는 기술 외에도 프로세스, 조직, 문화 등 전사적 관점이 필요합니다.",
                "DX 토막상식:<br/>DX를 위한 투자 시 단기적 ROI 뿐 아니라 장기적 가치도 고려해야 합니다.",
                "DX 토막상식:<br/>DX 과정에서 발생할 수 있는 실패와 역효과에 대한 대비가 필요합니다.",
                "DX 토막상식:<br/>DX는 기업의 규모나 업종에 관계없이 모든 기업에 필요한 과제입니다." 
                ],
      typeSpeed: 80, 
      backSpeed: 20, 
      cursorChar: '_', 
      shuffle: true, 
      smartBackspace: false, 
      loop: true 
    }); 
  }, 100);
  
}

function remove_spinner(msg) {
  document.getElementById(`dRow${k}_2`).innerHTML = "";
  document.getElementById(`dRow${k}_3`).innerHTML = "";
  document.getElementById(`p${k}_1`).innerHTML = "";
}

function update_image(k) {
  let img2 = document.createElement("img");
  img2.setAttribute("id", `image${k}_2`);
  img2.setAttribute("class", "custom_image fade-in-image");
  img2.onload = function () {
    document.getElementById(`a${k}_2`).setAttribute("data-pswp-width", img3.naturalWidth);
    document.getElementById(`a${k}_2`).setAttribute("data-pswp-height", img3.naturalHeight);
  };
  let a2 = document.createElement("a");
  a2.setAttribute("id", `a${k}_2`);
  a2.setAttribute("class", "custom_image");
  a2.setAttribute("data-pswp-width", "600");
  a2.setAttribute("data-pswp-height", "300");
  a2.setAttribute("target", "_blank");
  a2.appendChild(img2);
  
  let img3 = document.createElement("img");
  img3.setAttribute("id", `image${k}_3`);
  img3.setAttribute("class", "custom_image fade-in-image");
  img3.onload = function () {
    document.getElementById(`a${k}_3`).setAttribute("data-pswp-width", img3.naturalWidth2);
    document.getElementById(`a${k}_3`).setAttribute("data-pswp-height", img3.naturalHeight2);
  };
  let a3 = document.createElement("a");
  a3.setAttribute("id", `a${k}_3`);
  a3.setAttribute("class", "custom_image");
  a3.setAttribute("data-pswp-width", "600");
  a3.setAttribute("data-pswp-height", "300");
  a3.setAttribute("target", "_blank");
  a3.appendChild(img3);
  
  document.getElementById(`dRow${k}_2`).innerHTML = "";
  document.getElementById(`dRow${k}_3`).innerHTML = "";
  
  document.getElementById(`dRow${k}_2`).appendChild(a2);
  document.getElementById(`dRow${k}_3`).appendChild(a3);
  
  document.getElementById(`image${k}_2`).src = "data:image/png;base64," + globalRecvData[k].image_bi_scale;
  document.getElementById(`a${k}_2`).href = "data:image/png;base64," + globalRecvData[k].image_bi_scale;
  document.getElementById(`image${k}_3`).src = "data:image/png;base64," + globalRecvData[k].image_out;
  document.getElementById(`a${k}_3`).href = "data:image/png;base64," + globalRecvData[k].image_out;
  
  document.getElementById(`image${k}_scalebar`).src = "data:image/png;base64," + globalRecvData[k].image_scalebar;

  let label_1 = document.createElement("span")
  label_1.setAttribute("style", "position: absolute; top: 0; left: 50%; transform: translateX(-50%); color: white; background-color: rgba(0, 0, 0, 0.5); padding: 5px; border-radius: 5px;")
  label_1.innerHTML = "Section"
  document.getElementById(`a${k}_2`).append(label_1)
  
  let label_2 = document.createElement("span")
  label_2.setAttribute("style", "position: absolute; top: 0; left: 50%; transform: translateX(-50%); color: white; background-color: rgba(0, 0, 0, 0.5); padding: 5px; border-radius: 5px;")
  label_2.innerHTML = "Segmentation"
  document.getElementById(`a${k}_3`).append(label_2)
  
  const temp = globalRecvData[k].data;
  
  let ocrString;
  if (currentCommand == "RUN") {
    if (isNaN(parseInt(document.getElementById(opt_scale).value))) {
      ocrString = "OCR";
    } else {
      ocrString = "MANUAL";
    }
  } else {
    if (isNaN(parseInt(document.getElementById(`manual_scale_${k}`).value))) {
      ocrString = "OCR";
    } else {
      ocrString = "MANUAL";
    }
  }
  
  document.getElementById(`p${k}_1`).innerHTML = `
  <b style="font-size:27px">${k + 1}</b>&nbsp;&nbsp;${globalRecvData[k].reqid} > <b>${globalRecvData[k].filename}</b><br>
      Scale (${ocrString}) : ${globalRecvData[k].option_scale} &#181;m&nbsp;&nbsp;&nbsp;<img src="${"data:image/png;base64," + globalRecvData[k].image_scalebar}" style="height:10px"/>
      <br>
    <table class="mb-1" style="font-size:12px;" >
      <thead> 
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse;">&nbsp;</th>
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse;line-height:110%;">&nbsp; 개수 N.avg &nbsp;</th>
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse;line-height:110%;">&nbsp; 개수 N.std &nbsp;</th>
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse;line-height:110%;">&nbsp; 면적 A.avg &nbsp;</th>
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse;line-height:110%;">&nbsp; 면적 A.std &nbsp;</th>
        </tr>
      </thead>
      <tbody>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Diameter (&#181;m)</th>
          <td class="custom_td">${temp['Diameter (um) N_Avg.']}</td>
          <td class="custom_td">${temp['Diameter (um) N_Std.']}</td>
          <td class="custom_td">${temp['Diameter (um) A_Avg.']}</td>
          <td class="custom_td">${temp['Diameter (um) A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Major diameter (&#181;m)</th>
          <td class="custom_td">${temp['Major diameter (um) N_Avg.']}</td>
          <td class="custom_td">${temp['Major diameter (um) N_Std.']}</td>
          <td class="custom_td">${temp['Major diameter (um) A_Avg.']}</td>
          <td class="custom_td">${temp['Major diameter (um) A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Minor diameter (&#181;m)</th>
          <td class="custom_td">${temp['Minor diameter (um) N_Avg.']}</td>
          <td class="custom_td">${temp['Minor diameter (um) N_Std.']}</td>
          <td class="custom_td">${temp['Minor diameter (um) A_Avg.']}</td>
          <td class="custom_td">${temp['Minor diameter (um) A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Area (&#181;m&#178;)</th>
          <td class="custom_td">${temp['Area (um2) N_Avg.']}</td>
          <td class="custom_td">${temp['Area (um2) N_Std.']}</td>
          <td class="custom_td">${temp['Area (um2) A_Avg.']}</td>
          <td class="custom_td">${temp['Area (um2) A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Perimeter (&#181;m)</th>
          <td class="custom_td">${temp['Perimeter (um) N_Avg.']}</td>
          <td class="custom_td">${temp['Perimeter (um) N_Std.']}</td>
          <td class="custom_td">${temp['Perimeter (um) A_Avg.']}</td>
          <td class="custom_td">${temp['Perimeter (um) A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Circularity</th>
          <td class="custom_td">${temp['Circularity N_Avg.']}</td>
          <td class="custom_td">${temp['Circularity N_Std.']}</td>
          <td class="custom_td">${temp['Circularity A_Avg.']}</td>
          <td class="custom_td">${temp['Circularity A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Convexity</th>
          <td class="custom_td">${temp['Convexity N_Avg.']}</td>
          <td class="custom_td">${temp['Convexity N_Std.']}</td>
          <td class="custom_td">${temp['Convexity A_Avg.']}</td>
          <td class="custom_td">${temp['Convexity A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Solidity</th>
          <td class="custom_td">${temp['Solidity N_Avg.']}</td>
          <td class="custom_td">${temp['Solidity N_Std.']}</td>
          <td class="custom_td">${temp['Solidity A_Avg.']}</td>
          <td class="custom_td">${temp['Solidity A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Aspect ratio</th>
          <td class="custom_td">${temp['Aspect ratio N_Avg.']}</td>
          <td class="custom_td">${temp['Aspect ratio N_Std.']}</td>
          <td class="custom_td">${temp['Aspect ratio A_Avg.']}</td>
          <td class="custom_td">${temp['Aspect ratio A_Std.']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">num of Droplets</th>
          <td class="custom_td" colspan="4">${temp['num of Droplets']}</td>
        </tr>
        <tr align="center">
          <th style="background-color: #c8c8c8;border: 1px solid #6b6b6b; border-collapse: collapse; padding-left: 5px; padding-right: 5px;">Coverage (%)</th>
          <td class="custom_td" colspan="4">${temp['Coverage (%)']}</td>
        </tr>
      </tbody>
    </table>
    <div class="btn-group justify-content-end" role="group">
      <button type="button" class="btn btn-outline-gray-500 btn-sm" onclick="downloadCsvWithIndex(${k})">CSV</button>
      <button type="button" class="btn btn-outline-gray-500 btn-sm" onclick="downloadImageWithIndex(${k})">IMG</button>
      <button type="button" class="btn btn-outline-gray-500 btn-sm" onclick="downloadPdfWithIndex(${k})">PDF</button>
    </div>
    <div class="btn-group justify-content-end" role="group">
      <button type="button" class="btn btn-outline-gray-500 btn-sm" onclick="displayToggle(${k})">Set Scale</button>
    </div>
    <div class="btn-group justify-content-end" role="group">
      <button type="button" class="btn btn-outline-gray-500 btn-sm" onclick="manualManipulate(${k})">Measure Mode</button>
    </div>
    <div class="form-check form-switch" style="position: absolute; top: 18px; right: 18px;">
      <label class="form-check-label" for="flexSwitchCheckChecked">결과</label>
      <input class="form-check-input" type="checkbox" id="resSwitch${k}" checked onchange="drawPlot()">
    </div>
    <br/>
    <br/>
    <span style="display:none;">Execution Time: ${globalRecvData[k].exec_time} sec</span>
      `;
      
      
    const temp_datail = globalRecvData[k].detail;
    
    const d1 = temp_datail["Diameter (um)"];
    const d2 = temp_datail["Circularity"];
    const d3 = temp_datail["Aspect ratio"]; 
    
    if (temp['Diameter (um) N_Avg.'] == null) {
      return;
    }
    
    const trace1 = {
      x: Object.keys(d1).map(function (key) { return d1[key] }),
      name: 'control',
      autobinx: true,
      histnorm: "count",
      marker: {
        color: "rgba(255, 100, 102, 0.7)",
        line: {
          color: "rgba(255, 100, 102, 1)",
          width: 1
        }
      },
      opacity: 0.5,
      type: "histogram",
    };
    
    const trace2 = {
      x: Object.keys(d2).map(function (key) { return d2[key] }),
      name: 'control',
      autobinx: true,
      histnorm: "count",
      marker: {
        color: "rgba(255, 100, 102, 0.7)",
        line: {
          color: "rgba(255, 100, 102, 1)",
          width: 1
        }
      },
      opacity: 0.5,
      type: "histogram",
    };
    
    const trace3 = {
      x: Object.keys(d3).map(function (key) { return d3[key] }),
      name: 'control',
      autobinx: true,
      histnorm: "count",
      marker: {
        color: "rgba(255, 100, 102, 0.7)",
        line: {
          color: "rgba(255, 100, 102, 1)",
          width: 1
        }
      },
      opacity: 0.5,
      type: "histogram",
    };
    
    const customLayout1 = {
      showlegend: false,
      bargap: 0.05,
      bargroupgap: 0.2,
      // barmode: "overlay",
      title: { text: "Diameter (µm)", font: { size: 15 } },
      plot_bgcolor: "#FFF",
      paper_bgcolor: "#FFF",
      margin: { l: 60, r: 30, b: 30, t: 60, pad: 5 },
      yaxis: { title: "", },
    };
    
    const customLayout2 = {
      showlegend: false,
      bargap: 0.05,
      bargroupgap: 0.2,
      // barmode: "overlay",
      title: { text: "Circularity", font: { size: 15 } },
      plot_bgcolor: "#FFF",
      paper_bgcolor: "#FFF",
      margin: { l: 60, r: 30, b: 30, t: 60, pad: 5 },
      yaxis: { title: "", },
    };
    
    const customLayout3 = {
      showlegend: false,
      bargap: 0.05,
      bargroupgap: 0.2,
      // barmode: "overlay",
      title: { text: "Aspect ratio", font: { size: 15 } },
      plot_bgcolor: "#FFF",
      paper_bgcolor: "#FFF",
      margin: { l: 60, r: 30, b: 30, t: 60, pad: 5 },
      yaxis: { title: "", },
    };
    
    const customConfig = { responsive: true, displaylogo: false, staticPlot: true };
    
    Plotly.newPlot(`dPlot${k}_1`, [trace1], customLayout1, customConfig);
    
    Plotly.newPlot(`dPlot${k}_2`, [trace2], customLayout2, customConfig);
    
    Plotly.newPlot(`dPlot${k}_3`, [trace3], customLayout3, customConfig); 
    
    
    
  // add mag
  setTimeout(function () {
    magnify(`image${k}_2`, 5);
  }, 1000);
  
}

const boxPlotList = [
  ['Diameter (um) A_Avg.', 'µm'],
  ['Diameter (um) A_Std.', 'µm'],
  ['Diameter (um) N_Avg.', 'µm'],
  ['Diameter (um) N_Std.', 'µm'],
  
  ['Major diameter (um) A_Avg.', 'µm'],
  ['Major diameter (um) A_Std.', 'µm'],
  ['Major diameter (um) N_Avg.', 'µm'],
  ['Major diameter (um) N_Std.', 'µm'],
  
  ['Minor diameter (um) A_Avg.', 'µm'],
  ['Minor diameter (um) A_Std.', 'µm'],
  ['Minor diameter (um) N_Avg.', 'µm'],
  ['Minor diameter (um) N_Std.', 'µm'],
  
  ['Area (um2) A_Avg.', 'µm²'],
  ['Area (um2) A_Std.', 'µm²'],
  ['Area (um2) N_Avg.', 'µm²'],
  ['Area (um2) N_Std.', 'µm²'],
  
  ['Perimeter (um) A_Avg.', 'µm'],
  ['Perimeter (um) A_Std.', 'µm'],
  ['Perimeter (um) N_Avg.', 'µm'],
  ['Perimeter (um) N_Std.', 'µm'],
  
  ['Circularity A_Avg.', ''],
  ['Circularity A_Std.', ''],
  ['Circularity N_Avg.', ''],
  ['Circularity N_Std.', ''],
  
  ['Convexity A_Avg.', ''],
  ['Convexity A_Std.', ''],
  ['Convexity N_Avg.', ''],
  ['Convexity N_Std.', ''],
  
  ['Solidity A_Avg.', ''],
  ['Solidity A_Std.', ''],
  ['Solidity N_Avg.', ''],
  ['Solidity N_Std.', ''],
  
  ['Aspect ratio A_Avg.', ''],
  ['Aspect ratio A_Std.', ''],
  ['Aspect ratio N_Avg.', ''],
  ['Aspect ratio N_Std.', ''],
  
  ['num of Droplets', ''],
  ['Coverage (%)', '%'],
];

function drawPlot() {
  
  const mainPlot1TypeIndex = document.getElementById("opt_main_plot_1_type").selectedIndex;
  const mainPlot2TypeIndex = document.getElementById("opt_main_plot_2_type").selectedIndex;
  const mainPlot3TypeIndex = document.getElementById("opt_main_plot_3_type").selectedIndex;
  
  let xx = [];
  let yy1 = [];
  let yy2 = [];
  let yy3 = [];
  let fname = [];
  for (k in globalRecvData) {
    if (document.getElementById(`resSwitch${k}`).checked == true) {
      xx.push(globalRecvData[k].filename_category);
      fname.push(`${parseInt(k) + 1}. ${globalRecvData[k].filename}`);
      const temp = globalRecvData[k].data;
      yy1.push(temp[boxPlotList[mainPlot1TypeIndex][0]]);
      yy2.push(temp[boxPlotList[mainPlot2TypeIndex][0]]);
      yy3.push(temp[boxPlotList[mainPlot3TypeIndex][0]]);
    }
  }
  
  const trace1 = {
    y: yy1,
    x: xx,
    marker: { color: "#a50034" },
    type: "box",
    text: fname,
    boxpoints: "all",
    jitter: 0.3,
    pointpos: 0,
  };
  
  const title1 = document.getElementById("opt_main_plot_1_type").options[document.getElementById("opt_main_plot_1_type").selectedIndex].text;
  
  const customLayout1 = {
    showlegend: false,
    title: { text: title1, font: { size: 20 } },
    plot_bgcolor: "#FFF",
    paper_bgcolor: "#FFF",
    margin: { l: 60, r: 30, b: 30, t: 30, pad: 5 },
    yaxis: { title: boxPlotList[mainPlot1TypeIndex][1], },
    boxmode: "group",
  };
  
  const trace2 = {
    y: yy2,
    x: xx,
    marker: { color: "#a50034" },
    type: "box",
    text: fname,
    boxpoints: "all",
    jitter: 0.3,
    pointpos: 0,
  };
  
  const title2 = document.getElementById("opt_main_plot_2_type").options[document.getElementById("opt_main_plot_2_type").selectedIndex].text;
  
  const customLayout2 = {
    showlegend: false,
    title: { text: title2, font: { size: 20 } },
    plot_bgcolor: "#FFF",
    paper_bgcolor: "#FFF",
    margin: { l: 60, r: 30, b: 30, t: 30, pad: 5 },
    yaxis: { title: boxPlotList[mainPlot2TypeIndex][1], },
    boxmode: "group",
  };
  
  const trace3 = {
    y: yy3,
    x: xx,
    marker: { color: "#a50034" },
    type: "box",
    text: fname,
    boxpoints: "all",
    jitter: 0.3,
    pointpos: 0,
  };
  
  const title3 = document.getElementById("opt_main_plot_3_type").options[document.getElementById("opt_main_plot_3_type").selectedIndex].text;
  
  const customLayout3 = {
    showlegend: false,
    title: { text: title3, font: { size: 20 } },
    plot_bgcolor: "#FFF",
    paper_bgcolor: "#FFF",
    margin: { l: 60, r: 30, b: 30, t: 30, pad: 5 },
    yaxis: { title: boxPlotList[mainPlot3TypeIndex][1], },
    boxmode: "group",
  };
  
  
  const customConfig = { responsive: true, displaylogo: false, };
  
  Plotly.newPlot("plotBox_1", [trace1], customLayout1, customConfig);
  let plotPromise1 = Plotly.toImage(document.getElementById("plotBox_1"), { format: 'png', height: 400, width: 600 });
  plotPromise1.then(value => { plot1base64 = value });
  
  Plotly.newPlot("plotBox_2", [trace2], customLayout2, customConfig);
  let plotPromise2 = Plotly.toImage(document.getElementById("plotBox_2"), { format: 'png', height: 400, width: 600 });
  plotPromise2.then(value => { plot2base64 = value });
  
  Plotly.newPlot("plotBox_3", [trace3], customLayout3, customConfig);
  let plotPromise3 = Plotly.toImage(document.getElementById("plotBox_3"), { format: 'png', height: 400, width: 600 });
  plotPromise3.then(value => { plot3base64 = value });
}

document.addEventListener("keydown", function (e) {
  mKeyBuffer.shift();
  mKeyBuffer.push(e.which);
  // console.log(...mKeyBuffer);
  
  if (e.which == 13) {
    // console.log(">>", e.target.id);
    if (String(e.target.id).startsWith("manual_scale_")) {
      const tp = String(e.target.id).split("_")[2];
      // console.log(parseInt(tp));
      manualRun(parseInt(tp));
    }
  }
  
  if (e.target.id == "opt_scale" || e.target.id == "opt_seed" || e.target.id == "opt_particle_diameter_thr") {
    return e.keyCode !== 69;
  };
  
  if (e.target.id == "opt_colormap" || e.target.id == "opt_boxplot_target") {
    // console.log(e);
    // temporary solution. !!!
    return false;
  }
  
  if (!$("textarea").is(":focus")) {
    switch (e.which) {
      case 79: /* key o */
        if (document.getElementById("buttonRun").disabled === false) {
          document.getElementById("files").click();
        };
        break;
      case 82: /* key r */
        if (e.ctrlKey) {
          // window.location.reload(); // chrome default function
        } else {
          document.getElementById("buttonRun").click();
        }
        break;
      case 191: /* key ? */
        if (e.ctrlKey && JSON.stringify(mKeyBuffer) == JSON.stringify([191, 191])) {
          mKeyBuffer = [0, 0];
          document.getElementById("dev_content").classList.toggle("custom_display");
          document.getElementById("devIcon").classList.toggle("custom_display");

          if (document.getElementById("devIcon").classList.contains("custom_display")) {
            currentMode = "USER";
          } else {
            currentMode = "DEV";
          }
        }
        break;
      default:
        break;
    }; 
  };
});

function getTimeStamp() {
  const nowTimeStamp = new Date();
  return nowTimeStamp.getFullYear() +
    (nowTimeStamp.getMonth() + 1).toString().padStart(2, '0') +
    nowTimeStamp.getDate().toString().padStart(2, '0') + "_" +
    nowTimeStamp.getHours().toString().padStart(2, '0') +
    nowTimeStamp.getMinutes().toString().padStart(2, '0') +
    nowTimeStamp.getSeconds().toString().padStart(2, '0');
};

document.getElementById("buttonCsv").onclick = function () {
  let csvData = "";
  csvData = getCsvHeader();
  
  for (k in globalRecvData) {
    if (document.getElementById(`resSwitch${k}`).checked == true) {
      csvData = csvData + getCsvLine(k);
    }
  }
  
  let link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", "data:text/plain,\ufeff" + csvData);
  const subName = `_min_${globalRecvData[0].option_min_diameter_thr.toString().replace(".","")}`;
  link.setAttribute("download", "sam_for_droplet" + subName + "_" + getTimeStamp() + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function downloadCsvWithIndex(k) {
  let csvData = "";
  csvData = getCsvHeader();
  csvData = csvData + getCsvLine(k);
  
  let link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", "data:text/plain,\ufeff" + csvData);
  const subName =` _min_${globalRecvData[k].option_min_diameter_thr.toString().replace(".","")}`;
  filenameWithoutExtention = globalRecvData[k].filename.split('.').slice(0, -1).join('.')
  link.setAttribute("download", filenameWithoutExtention + subName + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getCsvHeader() {
  let header_0 = [];
  let header_1 = [];
  const header_list = [ [",","no,file"],
                        ["개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg,개수 N.avg",
                        "diameter(um),Major diameter(um),Minor diameter(um),area(um2),perimeter(um),Circularity,Convexity,Solidity,aspect ratio"],
                        ["개수 N.std,개수 N.std,개수 N.std,개수 N.std,개수 N.std,개수 N.std,개수 N.std,개수 N.std,개수 N.std",
                        "diameter(um),Major diameter(um),Minor diameter(um),area(um2),perimeter(um),Circularity,Convexity,Solidity,aspect ratio"],
                        ["면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg,면적 A.avg",
                        "diameter(um),Major diameter(um),Minor diameter(um),area(um2),perimeter(um),Circularity,Convexity,Solidity,aspect ratio"],
                        ["면적 A.std,면적 A.std,면적 A.std,면적 A.std,면적 A.std,면적 A.std,면적 A.std,면적 A.std,면적 A.std",
                        "diameter(um),Major diameter(um),Minor diameter(um),area(um2),perimeter(um),Circularity,Convexity,Solidity,aspect ratio"],
                      
                        [",,,,,,","num of Droplets,Coverage (%),min_diameter_thr,scale(um),scalerbar_px,scale_ratio,reqId"], 
                      ]; 
  header_list.map( value => {
    header_0.push(value[0]);
    header_1.push(value[1]);
  });
  return `${header_0.join()}\n${header_1.join()}\n`;
}

function getCsvLine(k) {
  const no = str(int(k) + 1);
  const fn = globalRecvData[k].filename.replaceAll('%', '%25').replaceAll('#', '%23');
  const temp = globalRecvData[k].data;
  
  const a = [temp['Diameter (um) N_Avg.'],
              temp['Major diameter (um) N_Avg.'],
              temp['Minor diameter (um) N_Avg.'],
              temp['Area (um2) N_Avg.'],
              temp['Perimeter (um) N_Avg.'],
              temp['Circularity N_Avg.'],
              temp['Convexity N_Avg.'],
              temp['Solidity N_Avg.'],
              temp['Aspect ratio N_Avg.']]
  const b = [temp['Diameter (um) N_Std.'],
              temp['Major diameter (um) N_Std.'],
              temp['Minor diameter (um) N_Std.'],
              temp['Area (um2) N_Std.'],
              temp['Perimeter (um) N_Std.'],
              temp['Circularity N_Std.'],
              temp['Convexity N_Std.'],
              temp['Solidity N_Std.'],
              temp['Aspect ratio N_Std.']]
  const c = [temp['Diameter (um) A_Avg.'],
              temp['Major diameter (um) A_Avg.'],
              temp['Minor diameter (um) A_Avg.'],
              temp['Area (um2) A_Avg.'],
              temp['Perimeter (um) A_Avg.'],
              temp['Circularity A_Avg.'],
              temp['Convexity A_Avg.'],
              temp['Solidity A_Avg.'],
              temp['Aspect ratio A_Avg.']]
  const d = [temp['Diameter (um) A_Std.'],
              temp['Major diameter (um) A_Std.'],
              temp['Minor diameter (um) A_Std.'],
              temp['Area (um2) A_Std.'],
              temp['Perimeter (um) A_Std.'],
              temp['Circularity A_Std.'],
              temp['Convexity A_Std.'],
              temp['Solidity A_Std.'],
              temp['Aspect ratio A_Std.']]
              
  const e = temp['num of Droplets'];
  const f = temp['Coverage (%)'];
  
  const min_diameter_thr = globalRecvData[k].option_min_diameter_thr;
  
  const s1 = globalRecvData[k].option_scale;
  const s2 = globalRecvData[k].calc_scalerbarpixel;
  const s3 = globalRecvData[k].calc_scaleratio;
  const rd = globalRecvData[k].reqid;
  
  const ss = [no, fn, ...a, ...b, ...c, ...d, e, f, min_diameter_thr, s1, s2, s3, rd];
  return ss.join(',') + '\n';
}

document.getElementById("buttonCsvDetail").onclick = function () {
  const dataKey = ['Segment', 'Diameter (um)','Major diameter (um)' ,'Minor diameter (um)' , 'Area (um2)', 'Perimeter (um)', 'Circularity', 'Convexity', 'Solidity', 'Aspect ratio', 'Center of moment' ]
  let csvData = "file,index," + "Segment, Diameter (um), Major diameter (um), Minor diameter (um), Area (um2), Perimeter (um), Circularity, Convexity, Solidity, Aspect ratio, Center of moment (x), Center of moment (y), min_diameter_thr\n";
  let mDict;
  let subDataKey;
  let tString;
  
  for (let kk = 0; kk < Object.keys(globalRecvData).length; kk++) {
    if (document.getElementById(`resSwitch${kk}`).checked == true) {
      try {
        mDict = globalRecvData[kk].detail;
        subDataKey = Object.keys(mDict["Segment"])

        const min_diameter_thr = globalRecvData[kk].option_min_diameter_thr;
        
        for (z in subDataKey) {
          tString = globalRecvData[kk].filename + "," + subDataKey[z]
          for (m in dataKey) {
            tString = tString + "," + mDict[dataKey[m]][subDataKey[z]]
          }
          csvData = csvData + tString + "," + min_diameter_thr + "\n";
        }
      } catch (error) {
        console.error("오류 발생:", error.message);
      }
    } 
  };
  
  let link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", "data:text/plain,\ufeff" + csvData);
  const subName = `_min_${globalRecvData[0].option_min_diameter_thr.toString().replace(".", "")}`;
  link.setAttribute("download", "sam_for_droplet_detail" + subName + "_" + getTimeStamp() + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  }
  
document.getElementById("buttonPdf").onclick = function () {
  uiButtonOff();
  
  const timeStamp = getTimeStamp();
  const userName = document.getElementById("username").innerText;
  
  let dd = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [60, 20, 60, 20], /* margin: [left, top, right, bottom] */
    compress: true,
    watermark: { text: 'BETA VERSION', color: 'blue', opacity: 0.1, bold: true, italics: false },
    info: {
      title: 'PDLC Droplet Image Analysis for SGF',
      author: 'LG Chem. Advanced Materials. DX Team.',
      subject: 'Analysis Report',
      keywords: 'SAM Droplet',
    },
    
    header: function (currentPage, pageCount, pageSize) {
      return [
        { text: 'PDLC Droplet Image Analysis for SGF - ' + userName + " - " + timeStamp, alignment: 'center' },
      ]
    },
    footer: function (currentPage, pageCount) {
      return { text: { text: "Copyright 2024 by LG Chem. All rights reserved." + " ".repeat(175) + currentPage.toString() + ' / ' + pageCount }, alignment: "center" }
    },
    content: [
      { image: lgchem_logo_base64, width: 150, },
      { text: '\n\nReport :', fontSize: 40, alignment: 'center' },
      { text: 'PDLC Droplet Image Analysis for SGF\n\n', fontSize: 40, alignment: 'center', bold: true },
      { text: timeStamp, fontSize: 20, alignment: 'center' },
      { text: userName, fontSize: 25, alignment: 'center' },
      { text: " ", fontSize: 40, alignment: 'center' },
      { qr: userName + " " + timeStamp, fit: '120', eccLevel: "H", alignment: 'center' },
      
      { image: lgchem_logo_base64, width: 150, pageBreak: 'before', },
      { text: " ", fontSize: 40, alignment: 'center' },
      { text: " ", fontSize: 40, alignment: 'center' },
      { text: " ", fontSize: 40, alignment: 'center' },
      { table: {
        body: [
            [ { image: plot1base64, width: 250, alignment: 'center' },
              { image: plot2base64, width: 250, alignment: 'center' },
              { image: plot3base64, width: 250, alignment: 'center' },
            ],
          ]
        },
        layout: 'noBorders',
      },
    ],
    styles: {
      header: {
        fontSize: 15,
        bold: false
      },
      subheader: {
        fontSize: 15,
        bold: false
      }
    } 
  }
  
  for (k in globalRecvData) {
    if (document.getElementById(`resSwitch${k}`).checked == true) {
      const temp = globalRecvData[k].data;
      
      const ddLogo = { image: lgchem_logo_base64, width: 150, pageBreak: 'before', };
      const ddtitle = { text: ` \n${globalRecvData[k].index + 1}. ${globalRecvData[k].filename}\n `, fontSize: 20, alignment: 'left', };
      const ddSubImage = {
        table: {
          body: [
            [
              // [
              //   {
              //     table: { 
              //       widths: ['*'],
              //       body: [ 
              //         [
              //           { image: document.getElementById(`a${k}_1`).href, width: 196, alignment: 'right' },
              //         ]
              //       ]
              //     },
              //     layout: 'noBorders',
              //   }
              // ],
              [ 
                { 
                  table: {
                    widths: ['*'],
                    body: [
                      [
                        { image: document.getElementById(`a${k}_1`).href, width: 250, alignment: 'center' },
                      ],
                      [
                        { image: document.getElementById(`a${k}_3`).href, width: 250, alignment: 'center' },
                      ],
                      // [
                      //   { image: document.getElementById(`a${k}_4`).href, width: 196, alignment: 'center' },
                      // ]
                    ]
                  },
                  layout: 'noBorders',
                }
              ],
              [
                { text: " " },
              ],
              [
                { text: "- Result\n " },
                {
                  table: {
                    body: [
                      ["", "N.avg", "N.std", "A.avg", "A.std"],
                      ["Diameter(µm)", temp['Diameter (um) N_Avg.'], temp['Diameter (um) N_Std.'], temp['Diameter (um) A_Avg.'], temp['Diameter (um) A_Std.']],
                      ["Major diameter(µm)", temp['Major diameter (um) N_Avg.'], temp['Major diameter (um) N_Std.'], temp['Major diameter (um) A_Avg.'], temp['Major diameter (um) A_Std.']],
                      ["Minor diameter(µm)", temp['Minor diameter (um) N_Avg.'], temp['Minor diameter (um) N_Std.'], temp['Minor diameter (um) A_Avg.'], temp['Minor diameter (um) A_Std.']],
                      ["Area(µm²)", temp['Area (um2) N_Avg.'], temp['Area (um2) N_Std.'], temp['Area (um2) A_Avg.'], temp['Area (um2) A_Std.']],
                      ["Perimeter(µm)", temp['Perimeter (um) N_Avg.'], temp['Perimeter (um) N_Std.'], temp['Perimeter (um) A_Avg.'], temp['Perimeter (um) A_Std.']],
                      ["Circularity", temp['Circularity N_Avg.'], temp['Circularity N_Std.'], temp['Circularity A_Avg.'], temp['Circularity A_Std.']],
                      ["Convexity", temp['Convexity N_Avg.'], temp['Convexity N_Std.'], temp['Convexity A_Avg.'], temp['Convexity A_Std.']],
                      ["Solidity", temp['Solidity N_Avg.'], temp['Solidity N_Std.'], temp['Solidity A_Avg.'], temp['Solidity A_Std.']],
                      ["Aspect Ratio", temp['Aspect ratio N_Avg.'], temp['Aspect ratio N_Std.'], temp['Aspect ratio A_Avg.'], temp['Aspect ratio A_Std.']],
                      ["num of Droplets", {text: temp['num of Droplets'], colSpan: 4, alignment: 'center'}],
                      ["Coverage (%)", {text: temp['Coverage (%)'], colSpan: 4, alignment: 'center'}],
                    ],
                  },
                  layout: 'defaultBorder', alignment: 'center'
                },
                // { text: " " },
                // {
                //   table: {
                //     body: [
                //       ["", "N", "N (%)", "A", "A (%)"],
                //       ["Normal Particles", temp['Normal particles N'],(100 - temp['Pore particle ratio (%) N']).toFixed(1),temp['Normal particles A'],(100 - temp['Pore particle ratio (%) A']).toFixed(1)],
                //       ["Pore Particles", temp['Pore particles N'],temp['Pore particle ratio (%) N'],temp['Pore particles A'],temp['Pore particle ratio (%) A']],
                //     ],
                //   },
                //   layout: 'defaultBorder', alignment: 'center'
                // },
                // { text: " \n Total Porosity (%) : " +  temp['Total porosity (%)']},
                { text: " \n \n- Option" },
                {
                  columns: [
                    {
                      ul: [
                        'Category : ' + globalRecvData[k].filename_category,
                        'min_diameter_threshold : ' + globalRecvData[k].option_min_diameter_thr + " µm",
                        // 'Particle Diameter Threshold : ' + globalRecvData[k].option_particle_diameter_thr + " µm",
                      ]
                    },
                    {
                      ul: [
                        'Scale : ' + globalRecvData[k].option_scale + " µm",
                        "Scale Bar Width : " + globalRecvData[k].calc_scalerbarpixel + " px",
                        "Scale Ratio : " + globalRecvData[k].calc_scaleratio.toFixed(6),
                      ]
                    }
                  ]
                },
                { text: " \n \n- Server Info" },
                {
                  columns: [
                    {
                      ul: [
                        'Core Version : ' + globalRecvData[k].core,
                        'Request ID : ' + globalRecvData[k].reqid,
                      ]
                    }
                  ]
                }
              ],
            ],
          ],
        },
        layout: 'noBorders',
      };
          
      dd.content.push(ddLogo);
      dd.content.push(ddtitle);
      dd.content.push(ddSubImage);
    } 
  }
      
  const subName = `_min_${globalRecvData[0].option_min_diameter_thr.toString().replace(".", "")}`;
  
  pdfMake.createPdf(dd).download("PDLC_Droplet_Image_Analysis_for_SGF" + subName + "_" + timeStamp + ".pdf");
  uiButtonOn();
};

function downloadPdfWithIndex(k) {
  const timeStamp = getTimeStamp();
  const userName = document.getElementById("username").innerText;
  
  let dd = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [60, 20, 60, 20], /* margin: [left, top, right, bottom] */
    compress: true,
    watermark: { text: 'BETA VERSION', color: 'blue', opacity: 0.1, bold: true, italics: false },
    info: {
      title: 'PDLC Droplet Image Analysis for SGF',
      author: 'LG Chem. Advanced Materials. DX Team.',
      subject: 'Analysis Report',
      keywords: 'SAM Droplet',
    },

    header: function (currentPage, pageCount, pageSize) {
      return [
        { text: 'PDLC Droplet Image Analysis for SGF - ' + userName + " - " + timeStamp, alignment: 'center' },
      ]
    },
    footer: function (currentPage, pageCount) {
      return { text: { text: "Copyright 2024 by LG Chem. All rights reserved." + " ".repeat(175) + currentPage.toString() + ' / ' + pageCount }, alignment: "center" }
    },
    content: [],
    styles: {
      header: {
        fontSize: 15,
        bold: false 
      },
      subheader: {
        fontSize: 15,
        bold: false
      }
    } 
  }
  
  const temp = globalRecvData[k].data;
  
  const ddLogo = { image: lgchem_logo_base64, width: 150 };
  const ddtitle = { text: ` \n${globalRecvData[k].index + 1}. ${globalRecvData[k].filename}\n `, fontSize: 20, alignment: 'left', };
  const ddSubImage = {
    table: {
      body: [
        [
          // [
          //   {
          //     table: {
          //       widths: ['*'],
          //       body: [
          //         [
          //           { image: document.getElementById(`a${k}_1`).href, width: 196, alignment: 'right' },
          //         ]
          //       ]
          //     },
          //     layout: 'noBorders',
          //   }
          // ],
          [
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    { image: document.getElementById(`a${k}_1`).href, width: 250, alignment: 'center' },
                  ],
                  [
                    { image: document.getElementById(`a${k}_3`).href, width: 250, alignment: 'center' },
                  ],
                // [
                //   { image: document.getElementById(`a${k}_3`).href, width: 196, alignment: 'center' },
                // ]
                ]
              },
              layout: 'noBorders',
            }
          ],
          [
            { text: " " },
          ],
          [
            { text: "- Result\n " },
            {
              table: {
                body: [
                  ["", "N.avg", "N.std", "A.avg", "A.std"],
                  ["Diameter(µm)", temp['Diameter (um) N_Avg.'], temp['Diameter (um) N_Std.'], temp['Diameter (um) A_Avg.'], temp['Diameter (um) A_Std.']],
                  ["Major diameter(µm)", temp['Major diameter (um) N_Avg.'], temp['Major diameter (um) N_Std.'], temp['Major diameter (um) A_Avg.'], temp['Major diameter (um) A_Std.']],
                  ["Minor diameter(µm)", temp['Minor diameter (um) N_Avg.'], temp['Minor diameter (um) N_Std.'], temp['Minor diameter (um) A_Avg.'], temp['Minor diameter (um) A_Std.']],
                  ["Area(µm²)", temp['Area (um2) N_Avg.'], temp['Area (um2) N_Std.'], temp['Area (um2) A_Avg.'], temp['Area (um2) A_Std.']],
                  ["Perimeter(µm)", temp['Perimeter (um) N_Avg.'], temp['Perimeter (um) N_Std.'], temp['Perimeter (um) A_Avg.'], temp['Perimeter (um) A_Std.']],
                  ["Circularity", temp['Circularity N_Avg.'], temp['Circularity N_Std.'], temp['Circularity A_Avg.'], temp['Circularity A_Std.']],
                  ["Convexity", temp['Convexity N_Avg.'], temp['Convexity N_Std.'], temp['Convexity A_Avg.'], temp['Convexity A_Std.']],
                  ["Solidity", temp['Solidity N_Avg.'], temp['Solidity N_Std.'], temp['Solidity A_Avg.'], temp['Solidity A_Std.']],
                  ["Aspect Ratio", temp['Aspect ratio N_Avg.'], temp['Aspect ratio N_Std.'], temp['Aspect ratio A_Avg.'], temp['Aspect ratio A_Std.']],
                  ["num of Droplets", {text: temp['num of Droplets'], colSpan: 4, alignment: 'center'}],
                  ["Coverage (%)", {text: temp['Coverage (%)'], colSpan: 4, alignment: 'center'}],
                ],
              },
              layout: 'defaultBorder', alignment: 'center'
            },
            // { text: " " },
            // {
            //   table: {
            //     body: [
            //       ["", "N", "N (%)", "A", "A (%)"],
            //       ["Normal Particles", temp['Normal particles N'],(100 - temp['Pore particle ratio (%) N']).toFixed(1),temp['Normal particles A'],(100 - temp['Pore particle ratio (%) A']).toFixed(1)],
            //       ["Pore Particles", temp['Pore particles N'],temp['Pore particle ratio (%) N'],temp['Pore particles A'],temp['Pore particle ratio (%) A']],
            //     ],
            //   },
            //   layout: 'defaultBorder', alignment: 'center'
            // },
            // { text: " \n Total Porosity (%) : " +  temp['Total porosity (%)']},
            { text: " \n \n- Option" },
            {
              columns: [
                {
                  ul: [
                    'Category : ' + globalRecvData[k].filename_category,
                    'min_diameter_threshold : ' + globalRecvData[k].option_min_diameter_thr + " µm",
                    // 'Particle Diameter Threshold : ' + globalRecvData[k].option_particle_diameter_thr + " µm",
                  ]
                },
                {
                  ul: [
                    'Scale : ' + globalRecvData[k].option_scale + " µm",
                    "Scale Bar Width : " + globalRecvData[k].calc_scalerbarpixel + " px",
                    "Scale Ratio : " + globalRecvData[k].calc_scaleratio.toFixed(6),
                  ]
                }
              ]
            },
            { text: " \n \n- Server Info" },
            {
              columns: [
                {
                  ul: [
                    'Core Version : ' + globalRecvData[k].core,
                    'Request ID : ' + globalRecvData[k].reqid,
                  ]
                }
              ]
            }
          ],
        ],
      ],
    },
    layout: 'noBorders',
  };
  
  dd.content.push(ddLogo);
  dd.content.push(ddtitle);
  dd.content.push(ddSubImage);

  const subName = `_min_${globalRecvData[k].option_min_diameter_thr.toString().replace(".", "")}`;

  filenameWithoutExtention = globalRecvData[k].filename.split('.').slice(0, -1).join('.')
  pdfMake.createPdf(dd).download(filenameWithoutExtention + subName + ".pdf");
}

document.getElementById("buttonImg1").onclick = function () {
  zipAllImage();
};

function zipAllImage() {
  let zip = new JSZip();

  for (let p = 0; p < Object.keys(globalRecvData).length; p++) {
    if (document.getElementById(`resSwitch${p}`).checked == true) {
      filenameWithoutExtention = globalRecvData[p].filename.split('.').slice(0, -1).join('.')

      // zip.file( `${filenameWithoutExtention}_${globalRecvData[p].reqid}.zip`, globalRecvData[p]["zip"], {base64: true});
      
      const subName = `_min_${globalRecvData[p].option_min_diameter_thr.toString().replace(".","")}`;
      
      zip.file( `${filenameWithoutExtention}_${globalRecvData[p].reqid}${subName}_raw.png`, globalRecvData[p].image_raw, {base64: true});
      zip.file( `${filenameWithoutExtention}_${globalRecvData[p].reqid}${subName}_section.png`, globalRecvData[p].image_bi_scale, {base64: true});
      zip.file( `${filenameWithoutExtention}_${globalRecvData[p].reqid}${subName}_segmentation.png`, globalRecvData[p].image_out, {base64: true});
    } 
  }

  const subName = `_min_${globalRecvData[0].option_min_diameter_thr.toString().replace(".","")}`;
  
  zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 9 } }).then(
    function( base64Text )
    {
      const fn = `PDLC_Droplet_Image_Analysis_for_SGF_images_All${subName}_${getTimeStamp()}.zip`;
      
      let element = document.createElement('a');
      element.setAttribute('href', 'data:application/octastream;base64,' + base64Text );
      element.setAttribute('download', fn );
      
      element.style.display = 'none';
      document.body.appendChild(element); element.click();
      document.body.removeChild(element);
    }
  ); 
}

function downloadImageWithIndex(k) {
  filenameWithoutExtention = globalRecvData[k].filename.split('.').slice(0, -1).join('.');
  const subName = `_min_${globalRecvData[k].option_min_diameter_thr.toString().replace(".","")}`;
  const fn = `PDLC_Droplet_Image_Analysis_for_SGF_images_${filenameWithoutExtention}${subName}_${getTimeStamp()}.zip`;
  
  let element = document.createElement('a');
  element.setAttribute('href', 'data:application/octastream;base64,' + globalRecvData[k].zip );
  element.setAttribute('download', fn );
  
  element.style.display = 'none';
  document.body.appendChild(element); element.click();
  document.body.removeChild(element); 
};

function zipImageWithIndex(k) {
  let zip = new JSZip();
  
  filenameWithoutExtention = globalRecvData[k].filename.split('.').slice(0, -1).join('.')
  
  const subName = `_min_${globalRecvData[k].option_min_diameter_thr.toString().replace(".","")}`;
  
  zip.file( `${filenameWithoutExtention}_${globalRecvData[k].reqid}${subName}_raw.png`, globalRecvData[k].image_raw, {base64: true});
  zip.file( `${filenameWithoutExtention}_${globalRecvData[k].reqid}${subName}_section.png`, globalRecvData[k].image_bi_scale, {base64: true});
  zip.file( `${filenameWithoutExtention}_${globalRecvData[k].reqid}${subName}_segmentation.png`, globalRecvData[k].image_out, {base64: true});
  
  zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 9 } }).then(
    function( base64Text )
    {
      globalRecvData[k]["zip"] = base64Text;
    }
  );
};

document.getElementById("buttonOptionSave").onclick = function () {
  const optionList = {
    autorun: document.getElementById("opt_autorun").checked,
    main_plot_1_type: document.getElementById("opt_main_plot_1_type").selectedIndex,
    main_plot_2_type: document.getElementById("opt_main_plot_2_type").selectedIndex,
    main_plot_3_type: document.getElementById("opt_main_plot_3_type").selectedIndex,
    timestamp: getTimeStamp(),
  };
  
  localStorage.setItem(OPTION_KEY, JSON.stringify(optionList));
};

function getExtension(filename) {
  return filename.split(".").pop();
};

document.getElementById("buttonOptionSetDefault1").onclick = function () {
  document.getElementById("opt_scale").value = "";
  document.getElementById("opt_scalebar").value = "";
};

document.getElementById("buttonOptionSetDefault2").onclick = function () {
  localStorage.removeItem(OPTION_KEY);
  document.getElementById("opt_autorun").checked = true;
  document.getElementById("opt_main_plot_1_type").selectedIndex = 0;
  document.getElementById("opt_main_plot_2_type").selectedIndex = 20;
  document.getElementById("opt_main_plot_3_type").selectedIndex = 33;
};

document.getElementById("buttonOptionredraw").onclick = function () {
  drawPlot();
}

function displayToggle(k) {
  document.getElementById(`cc${k}_1`).classList.toggle("custom_display");
  document.getElementById(`cc${k}_2`).classList.toggle("custom_display");
}

function setScaleBar(k) {
  let myImgElement = document.getElementById(`image${k}_1`);
  let myCanvasElement = document.createElement("canvas");
  myCanvasElement.setAttribute("id", "canvas");
  document.getElementById("scalebar_canvas").innerHTML = ""
  document.getElementById("scalebar_canvas").appendChild(myCanvasElement);
  myCanvasElement.width = myImgElement.naturalWidth;
  myCanvasElement.height = myImgElement.naturalHeight;
  let context = myCanvasElement.getContext('2d');
  context.drawImage(myImgElement, 0, 0, myImgElement.naturalWidth, myImgElement.naturalHeight, 0, 0, myImgElement.naturalWidth, myImgElement.naturalHeight);
  
  const myModal = new bootstrap.Modal(document.getElementById("addItemModal"), {});
  myModal.show();
  
  setTimeout(function () {
    document.getElementById("modal_body").scrollTo({
      top: 10000,
      left: 10000,
      behavior: 'smooth'
    });
  }, 50);
  
  context.lineWidth = 1;
  context.strokeStyle = "#ffff00";
  
  let sX, sY, cX, cY;
  let draw = false;
  
  document.getElementById(`manual_scalebar_${k}`).value = "";
  
  $("canvas").mousedown(function (e) {
    sX = parseInt(e.offsetX);
    sY = parseInt(e.offsetY);
    draw = true;
  })
  $("canvas").mousemove(function (e) {
    if (draw) {
      cX = parseInt(e.offsetX);
      cY = parseInt(e.offsetY);
      context.drawImage(myImgElement, 0, 0, myImgElement.naturalWidth, myImgElement.naturalHeight, 0, 0, myImgElement.naturalWidth, myImgElement.naturalHeight);
      context.strokeRect(sX, sY, cX - sX, cY - sY);
    }
  })
  $("canvas").mouseup(function (e) {
    draw = false;
    const x0 = min(sX, cX);
    const x1 = max(sX, cX);
    const y0 = min(sY, cY);
    const y1 = max(sY, cY);
    document.getElementById(`manual_scalebar_${k}`).value = `${x0},${y0},${x1},${y1}`;
  })
}

document.getElementById("buttonReload").onclick = function () {
  location.reload();
}

function magnify(imgID, zoom) {
  var img, glass, w, h, bw;
  img = document.getElementById(imgID);
  
  /*create magnifier glass:*/
  glass = document.createElement("DIV");
  glass.setAttribute("class", "img-magnifier-glass");
  
  /*insert magnifier glass:*/
  img.parentElement.insertBefore(glass, img);
  
  /*set background properties for the magnifier glass:*/
  glass.style.backgroundImage = "url('" + img.src + "')";
  glass.style.backgroundRepeat = "no-repeat";
  glass.style.backgroundSize = (img.width * zoom) + "px " + (img.height * zoom) + "px";
  bw = 3;
  w = glass.offsetWidth / 2;
  h = glass.offsetHeight / 2;
  
  try {
  glass.removeEventListener("mousemove", moveMagnifier);
  img.removeEventListener("mousemove", moveMagnifier);
  glass.removeEventListener("touchmove", moveMagnifier);
  img.removeEventListener("touchmove", moveMagnifier);
  // glass.removeEventListener("mouseenter", mouse_test1);
  glass.removeEventListener("mouseleave", mouse_test2);
  img.removeEventListener("mouseenter", mouse_test3);
  // img.removeEventListener("mouseleave", mouse_test4);
  } catch (error) {
    
  }
  
  /*execute a function when someone moves the magnifier glass over the image:*/
  glass.addEventListener("mousemove", moveMagnifier);
  img.addEventListener("mousemove", moveMagnifier);
  // glass.addEventListener("mouseenter", mouse_test1);
  glass.addEventListener("mouseleave", mouse_test2);
  img.addEventListener("mouseenter", mouse_test3);
  // img.addEventListener("mouseleave", mouse_test4);

  /*and also for touch screens:*/
  glass.addEventListener("touchmove", moveMagnifier);
  img.addEventListener("touchmove", moveMagnifier);
  
  // function mouse_test1(e) {
  //   console.log("1");
  // }
  function mouse_test2(e) { // mouseleave
    // console.log("2");
    glass.classList.add("custom_display");
  }
  function mouse_test3(e) {
    // console.log("3");
    glass.classList.remove("custom_display");
  }
  // function mouse_test4(e) {
  //   console.log("4");
  // }
  
  function moveMagnifier(e) {
    var pos, x, y;
    /*prevent any other actions that may occur when moving over the image*/
    e.preventDefault();
    /*get the cursor's x and y positions:*/
    pos = getCursorPos(e);
    x = pos.x;
    y = pos.y;
    /*prevent the magnifier glass from being positioned outside the image:*/
    if (x > img.width - (w / zoom)) { x = img.width - (w / zoom); }
    if (x < w / zoom) { x = w / zoom; }
    if (y > img.height - (h / zoom)) { y = img.height - (h / zoom); }
    if (y < h / zoom) { y = h / zoom; }
    /*set the position of the magnifier glass:*/
    glass.style.left = (x - w + img.offsetLeft) + "px";
    glass.style.top = (y - h) + "px";
    // console.log(x, y, w, h);
    /*display what the magnifier glass "sees":*/
    glass.style.backgroundPosition = "-" + ((x * zoom) - w + bw) + "px -" + ((y * zoom) - h + bw) + "px";
  }
  
  function getCursorPos(e) {
    let a, x = 0, y = 0;
    e = e || window.event;
    /*get the x and y positions of the image:*/
    a = img.getBoundingClientRect();
    /*calculate the cursor's x and y coordinates, relative to the image:*/
    x = e.pageX - a.left;
    y = e.pageY - a.top;
    /*consider any page scrolling:*/
    x = x - window.pageXOffset;
    y = y - window.pageYOffset;
    // console.log(x, y, e.pageX, e.pageY, a.left, a.top, window.pageXOffset, window.pageYOffset);
    return { x: x, y: y };
  }
  
  glass.classList.add("custom_display"); // 20230720 수정
}

////////////////////////////////////////////////////////////////////////////

let p5jsModal;

let drawBGFlag = 0;
let startX = null, startY = null;
let fBuffer = [];
let modalCanvas;

let p5jsFont;
let mSrcIdx = 0;
let mSubSrcIdx = 2;

let modalXY = document.getElementById("modalXY");
let modalColor = document.getElementById("modalColor");

let manual_manipulate_target_image = null;

function preload() {
  p5jsFont = loadFont('/static/assets/webfonts/JetBrainsMono-Thin.ttf');
  noLoop();
}

function setup() {
  noLoop();
  textFont(p5jsFont);
  modalCanvas = createCanvas(200, 200);
  modalCanvas.parent("p5js_canvas");
  strokeWeight(1);
  frameRate(24);
}

function windowResized() {
  // console.log("windowResized");
  if (isLooping() == true) {
    modalSourceChange(mSubSrcIdx);
  }
}

function draw() {
  // console.log("draw");
  if (isLooping() == true) {
    `modalXY.innerHTML = X ${parseInt(mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio)}, Y ${parseInt(mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio)}`;
    const ccolor = get(mouseX, mouseY);
    modalColor.innerHTML = `${ccolor[0]} ${ccolor[1]} ${ccolor[2]}`;
    modalColor.setAttribute("style", `font-size:8px; color: yellow; background-color:rgb(${ccolor[0]},${ccolor[1]},${ccolor[2]})`)
  }

  if (drawBGFlag > 0) {
    if (manual_manipulate_target_image == null) {
      background(0);
      resizeCanvas(10, 10);
    } else {
      background(manual_manipulate_target_image);
      if (globalRecvData[mSrcIdx].manualGridSwitch == true) {
        drawGrid();
      }
      drawMeas();
      drawArrow();
      drawRemove();
      drawSegmentInfo();
    }
    drawBGFlag--;
  }
  
  if (mouseIsPressed) {
    if (startX == null) {
        startX = mouseX;
        startY = mouseY;
    }
    stroke(255, 255, 0);
    background(manual_manipulate_target_image);
  
    if (globalRecvData[mSrcIdx].manualGridSwitch == true) {
      drawGrid();
    }
    
    drawMeas();
    drawArrow();
    drawRemove();
    drawSegmentInfo();
    
    if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch == true) {
      
    } else if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch == true ||
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch == true ||
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch == true) {
    
    } else {
      cMeas(startX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, startY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio); 
      fBuffer = [startX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, startY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio]; 
    } 
  } else {
      if (startX != null) {
        if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch == true) {
          // const limit_x = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
          // const limit_y = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
          // if (startX <= limit_x && mouseX <= limit_y) {
            if ( Math.abs(startX - mouseX) + Math.abs(startY - mouseY) > 3) {
              globalRecvData[mSrcIdx].p5[mSubSrcIdx].measBuffer.push([...fBuffer]);
            }
          // }
        }
      }
      startX = null;
      startY = null;
  }
}

function mouseClicked() {
  // console.log("isLooping()", isLooping())
  if (isLooping() == true) {
    const limit_x = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
    const limit_y = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;

    if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch == true) {
      if (mouseX <= limit_x && mouseY <= limit_y && mouseX >= 0 && mouseY >= 0) {
        cArrow(mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, globalRecvData[mSrcIdx].p5[mSubSrcIdx].arrowBuffer.length);
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].arrowBuffer.push([mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio]);
        // console.log(">", mouseX, mouseY, globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x, globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y);
      }
    }
    if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch == true) {
      if (mouseX <= limit_x && mouseY <= limit_y && mouseX >= 0 && mouseY >= 0) {
        cRemove1(mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio);
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove1Buffer.push([mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio]);
      }
    }
    if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch == true) {
      if (mouseX <= limit_x && mouseY <= limit_y && mouseX >= 0 && mouseY >= 0) {
        cRemove2(mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio);
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove2Buffer.push([mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio]);
      }
    }
    if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch == true) {
      if (mouseX <= limit_x && mouseY <= limit_y && mouseX >= 0 && mouseY >= 0) {
        cRemove3(mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio);
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove3Buffer.push([mouseX / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio, mouseY / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio]);
      }
    } 
  }
}

function drawGrid() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.map( v => {
    push();
    stroke('rgba(200,200,200,0.3)');
    strokeWeight(1);
    line(v[0], v[1], v[2], v[3]);
    pop();
  })

  push();
  strokeWeight(5);
  // translate(18, globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio - 20);
  translate(18, 25);
  text(`GRID : ${globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridStep} µm`, 0, 0);
  pop();
}

function drawSegmentInfo() {
  // console.log("drawSegmentInfo()", globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer)
  if (globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer.length != 0) {
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer.map ( v => {
      cSegmentInfo(v[0], v[1], v[2])
    })
  }
}

function cSegmentInfo(x, y, no) {
  x = x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  y = y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  push();
  stroke(255, 255, 0);
  fill(255, 255, 0);
  circle(x, y, 5);
  pop();
  
  push();
  strokeWeight(5);
  translate(x, y);
  text(`${no}`, 0, -10);
  pop();
}

function drawArrow() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].arrowBuffer.map( (v,i) => {
    cArrow(v[0], v[1], i);
    // console.log(">>>", v[0], v[1], i)
  })
}

function cArrow(x, y, no) {
  x = x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  y = y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  push();
  stroke(255, 255, 0);
  fill(255, 255, 0);
  
  line(x, y, x + 15, y - 15);
  
  translate(x, y);
  rotate(atan2(-15, 15));
  triangle(2, 0, 12, 4, 12, -4);
  pop();
  
  push();
  strokeWeight(5);
  translate(x + 15, y - 15);
  text(`${no + 1}`, 0, -5);
  pop();
}

function drawRemove() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove1Buffer.map( v => {
    cRemove1(v[0], v[1]);
  })
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove2Buffer.map( v => {
    cRemove2(v[0], v[1]);
  })
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove3Buffer.map( v => {
    cRemove3(v[0], v[1]);
  })
}

function cRemove1(x, y) {
  x = x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  y = y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  
  push();
  stroke(0, 255, 0);
  strokeWeight(4);
  line(x + 10, y - 20, x, y);
  line(x - 10, y - 5, x, y);
  pop();
  push();
  stroke(255, 255, 0);
  strokeWeight(1);
  line(x + 10, y - 20, x, y);
  line(x - 10, y - 5, x, y);
  pop();
}

function cRemove2(x, y) {
  x = x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  y = y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  
  push();
  stroke(255, 0, 0);
  strokeWeight(4);
  line(x + 10, y - 20, x, y);
  line(x - 10, y - 5, x, y);
  pop();
  push();
  stroke(255, 255, 0);
  strokeWeight(1);
  line(x + 10, y - 20, x, y);
  line(x - 10, y - 5, x, y);
  pop();
}

function cRemove3(x, y) {
  x = x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  y = y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  
  push();
  stroke(0, 0, 255);
  strokeWeight(4);
  line(x - 10, y + 10, x + 10, y - 10);
  line(x - 10, y - 10, x + 10, y + 10);
  pop();
  push();
  stroke(255, 255, 0);
  strokeWeight(1);
  line(x - 10, y + 10, x + 10, y - 10);
  line(x - 10, y - 10, x + 10, y + 10);
  pop();
}

function drawMeas() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].measBuffer.map( v => {
    cMeas(v[0], v[1], v[2], v[3]);
  })
}

function cMeas(sX, sY, mX, mY) {
  
  sX = sX * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  sY = sY * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  mX = mX * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  mY = mY * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;

  line(sX, sY, mX, mY);
  
  push();
  fill(255, 255, 0);
  translate(sX, sY);
  rotate(atan2(mY - sY, mX - sX));
  triangle(0, 0, 10, 4, 10, -4);
  pop();
  
  push();
  fill(255, 255, 0);
  translate(mX, mY);
  rotate(atan2(mY - sY, mX - sX));
  triangle(0, 0, -10, 4, -10, -4);
  pop();
  
  let d = parseFloat(dist(sX, sY, mX, mY)) * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_target_scale_ratio / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio * 1.0094; // 92
  push();
  strokeWeight(5);
  textAlign(CENTER);
  // translate(startX + (mouseX - startX) / 2, startY + (mouseY - startY) / 2);
  // translate(startX + (mouseX - startX) / 4, startY + (mouseY - startY) / 4);
  translate(sX + (mX - sX) / 1.2, sY + (mY - sY) / 1.2);
  rotate(atan2(mY - sY, mX - sX));
  text(`${nfc(d, 2)} µm`, 0, -10);
  pop();
}

function modalButtonMeasClear() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].measBuffer = [];
  drawBGFlag = 10;
}

function modalButtonArrowClear() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].arrowBuffer = [];
  drawBGFlag = 10;
}

function modalButtonRemoveClear() {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove1Buffer = [];
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove2Buffer = [];
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove3Buffer = [];
  drawBGFlag = 10;
}

function modalButtonImageSave() {
  const fname = globalRecvData[mSrcIdx].filename;
  saveCanvas(modalCanvas , `analysis_${getTimeStamp()}_${fname}`);
  drawBGFlag = 10;
}

function modalSwitchMeasMode(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = e;
  if (e == true) {
    // document.getElementById("sw1").checked = false;
    // globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = false;
    document.getElementById("sw2").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = false;
    document.getElementById("sw3").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = false;
    document.getElementById("sw8").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = false;
    document.getElementById("sw9").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = false;
  }
}

function modalSwitchArrowMode(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = e;
  if (e == true) {
    document.getElementById("sw1").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = false;
    // document.getElementById("sw2").checked = false;
    // globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = false;
    document.getElementById("sw3").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = false;
    document.getElementById("sw8").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = false;
    document.getElementById("sw9").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = false;
  }
}

function modalSwitchRemoveMode1(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = e;
  if (e == true) {
    document.getElementById("sw1").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = false;
    document.getElementById("sw2").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = false;
    // document.getElementById("sw3").checked = false;
    // globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = false;
    document.getElementById("sw8").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = false;
    document.getElementById("sw9").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = false;
  }
}

function modalSwitchRemoveMode2(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = e;
  if (e == true) {
    document.getElementById("sw1").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = false;
    document.getElementById("sw2").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = false;
    document.getElementById("sw3").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = false;
    // document.getElementById("sw8").checked = false;
    // globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = false;
    document.getElementById("sw9").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = false;
  }
}


function modalSwitchRemoveMode3(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = e;
  if (e == true) {
    document.getElementById("sw1").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch = false;
    document.getElementById("sw2").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch = false;
    document.getElementById("sw3").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch = false;
    document.getElementById("sw8").checked = false;
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch = false;
    // document.getElementById("sw9").checked = false;
    // globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch = false;
  }
}


function modalSwitchSegmentInfo(e) {
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualSegmentInfoModeSwitch =  e;
  if (e == true) {
    const temp = globalRecvData[mSrcIdx].detail["Center of moment"];
    const temp2 = globalRecvData[mSrcIdx].data["dst_com"];
    const temp3 = globalRecvData[mSrcIdx].data["img_com"];
    Object.keys(temp).forEach( p => {
      // console.log(p, temp[p])
      // globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer.push([temp[p][0], temp[p][1], parseInt(p)])
      if(mSubSrcIdx == 2) { // segementation
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer.push([temp2[p][0], temp2[p][1], parseInt(p)])
      } else { // raw
        globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer.push([temp3[p][0], temp3[p][1], parseInt(p)])
      }
    });
  } else {
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].segmentInfoBuffer = [];
  }
  drawBGFlag = 10;
}

function modalInputGridStepChange() {
  // console.log("modalInputGridStepChange()");
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer = [];
  modalSwitchGrid(true);
}

function modalSwitchGrid(e) {
  globalRecvData[mSrcIdx].manualGridSwitch = e;
  
  const gridStepObject = document.getElementById("gridStep");

  if (globalRecvData[mSrcIdx].manualGridSwitch == true) {
    gridStepObject.disabled = false;
  } else {
    gridStepObject.disabled = true;
  }
  
  const dx = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  const dy = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridStep = (parseInt(gridStepObject.value) > 0) ? parseInt(gridStepObject.value) : 1;
  
  // console.log(dx,dy)
  
  if (globalRecvData[mSrcIdx].manualGridSwitch == true) {
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([0, dy / 2, dx, dy / 2])
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([dx / 2, 0, dx / 2, dy])

    const u = globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridStep / globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_target_scale_ratio * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
    const w = max( parseInt(( dy / 2 ) / u) + 1, parseInt(( dx / 2 ) / u) + 1)
    
    for(let i = 1; i < w; i++) {
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([0, dy / 2 - u * i, dx, dy / 2 - u * i])
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([0, dy / 2 + u * i, dx, dy / 2 + u * i])
      
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([dx / 2 - u * i, 0 , dx / 2 - u * i, dy])
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([dx / 2 + u * i, 0 , dx / 2 + u * i, dy])
    }
    
    for(let i = 0; i < w; i=i+10) {
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([0, dy / 2 - u * i, dx, dy / 2 - u * i])
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([0, dy / 2 + u * i, dx, dy / 2 + u * i])
      
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([dx / 2 - u * i, 0 , dx / 2 - u * i, dy])
      globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer.push([dx / 2 + u * i, 0 , dx / 2 + u * i, dy])
    } 
  } else {
    globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer = [];
  }
  
  drawBGFlag = 10;
}


function modalSourceChange(subIdx) {
  noLoop();
  
  let targetImg;
  
  mSubSrcIdx = subIdx;
  globalRecvData[mSrcIdx].subSourceIndex = subIdx;

  const removeMenu = document.getElementById("removeMenuArea");

  if (subIdx == 0) {
    targetImg = document.getElementById(`image${mSrcIdx}_1`);
    manual_manipulate_target_image = loadImage("data:image/png;base64," + globalRecvData[mSrcIdx].image_raw);
    // document.getElementById("modalButtonRemoveRun").disabled = true;
    if (removeMenu.classList.contains('custom_display') == false) {
      removeMenu.classList.add("disappear")
      setTimeout(() => {
        document.getElementById("removeMenuArea").classList.add("custom_display");
      }, 701);
    }
  } else if (subIdx == 1) {
    targetImg = document.getElementById(`image${mSrcIdx}_2`);
    manual_manipulate_target_image = loadImage("data:image/png;base64," + globalRecvData[mSrcIdx].image_bi_scale);
    // document.getElementById("modalButtonRemoveRun").disabled = true;
    if (removeMenu.classList.contains('custom_display') == false) {
      removeMenu.classList.add("disappear")
      setTimeout(() => {
        document.getElementById("removeMenuArea").classList.add("custom_display");
      }, 701);
    }
  } else if (subIdx == 2) {
    targetImg = document.getElementById(`image${mSrcIdx}_3`);
    manual_manipulate_target_image = loadImage("data:image/png;base64," + globalRecvData[mSrcIdx].image_out);
    // document.getElementById("modalButtonRemoveRun").disabled = false;
    if (removeMenu.classList.contains('custom_display') == false) {
      removeMenu.classList.add("disappear")
      setTimeout(() => {
        document.getElementById("removeMenuArea").classList.add("custom_display");
      }, 701);
    }
  }
  
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_target_scale_ratio = globalRecvData[mSrcIdx].calc_scaleratio;
  
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x = targetImg.naturalWidth;
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y = targetImg.naturalHeight;
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].div_x = document.getElementById("p5js_canvas").offsetWidth;
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].div_y = document.getElementById("p5js_canvas").offsetHeight;
  
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio = Math.min(globalRecvData[mSrcIdx].p5[mSubSrcIdx].div_x / globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x, globalRecvData[mSrcIdx].p5[mSubSrcIdx].div_y / globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y);
  
  let fit_img_x = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_x * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  let fit_img_y = globalRecvData[mSrcIdx].p5[mSubSrcIdx].img_y * globalRecvData[mSrcIdx].p5[mSubSrcIdx].manual_manipulate_screen_ratio;
  
  resizeCanvas(fit_img_x, fit_img_y);
  
  globalRecvData[mSrcIdx].p5[mSubSrcIdx].gridBuffer = [];
  modalSwitchGrid(globalRecvData[mSrcIdx].manualGridSwitch);
  
  document.getElementById("sw1").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualMeasureModeSwitch;
  document.getElementById("sw2").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualArrowModeSwitch;
  document.getElementById("sw3").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode1Switch;
  document.getElementById("sw8").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode2Switch;
  document.getElementById("sw9").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualRemoveMode3Switch;
  document.getElementById("sw4").checked = globalRecvData[mSrcIdx].manualGridSwitch;
  document.getElementById("sw5").checked = globalRecvData[mSrcIdx].p5[mSubSrcIdx].manualSegmentInfoModeSwitch;
  
  drawBGFlag = 10;
  loop()
}

function manualManipulate(k) {
  p5jsModal.show();
  
  document.getElementById("modalSrcImageName").innerHTML = globalRecvData[k].filename;
  mSrcIdx = k;
  
  // measBuffer = []; // 여기 버퍼 확인해서 데이터가 있으면 스킵 해야 함..
  
  setTimeout(() => {
    modalSourceChange(mSubSrcIdx);
  }, 200);
}

$("#manualModeModal").on("hidden.bs.modal", function () {
  noLoop();
});

function modalButtonRedraw() {
  modalSourceChange(mSubSrcIdx);
}

function modalButtonHelp() {
  window.open('http://[MLDL주소]/home/manual/image_manual_mode/', '_blank');
}

function modalButtonRemoveRun() {
  console.log("modalButtonRemoveRun()");
  p5jsModal.hide();
  noLoop();
  
  const remove1Buff = globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove1Buffer;
  const remove2Buff = globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove2Buffer;
  const remove3Buff = globalRecvData[mSrcIdx].p5[mSubSrcIdx].remove3Buffer;
  console.log(remove1Buff, remove2Buff, remove3Buff);
  
  if (remove1Buff.length == 0 && remove2Buff.length == 0 && remove3Buff.length == 0) {
    notyf.error("Point Buffer is Empty !");
  } else {
    manualRun(mSrcIdx, remove1Buff, remove2Buff, remove3Buff);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////






window.addEventListener('DOMContentLoaded', function () {
  console.log(`%cⓒ 2024. LG Chem. All Rights Reserved. Advanced Materials. DX Team.`, 'color:#a50034;font-size:10px;');
  notyf = new Notyf();
  
  const savedOption = localStorage.getItem(OPTION_KEY);
  let parsedOption = null;
  
  if (savedOption !== null) {
    parsedOption = JSON.parse(savedOption);
    document.getElementById("opt_autorun").checked = parsedOption.autorun;
    document.getElementById("opt_main_plot_1_type").selectedIndex = parsedOption.main_plot_1_type;
    document.getElementById("opt_main_plot_2_type").selectedIndex = parsedOption.main_plot_2_type;
    document.getElementById("opt_main_plot_3_type").selectedIndex = parsedOption.main_plot_3_type;
  } else {
    //
  }
  
  p5jsModal = new bootstrap.Modal(document.getElementById("manualModeModal"), {});
});