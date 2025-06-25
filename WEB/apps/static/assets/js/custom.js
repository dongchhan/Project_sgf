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
    availWidth: screen.availWidth
    availHeight: screen.availHeight
    outerWidth: window.outerWidth
    outerHeight: window.outerHeight
    innerWidth: window.innerWidth
    innerHeight: window.innerHeight
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

document.getElementById("files").onchange function () {
  
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
  
  
}