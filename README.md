# Project_sgf

## 분석 Flow 

### 핵심 파일 
- WEB/apps/home/routes.py
- WEB/apps/static/assets/custom.js
- API/sam_logic_v2_0_0.py
- API/main.py

### Flow
> __custom.js__  
- line 135: document.getElementById("files").onchange  
처음 이미지를 받는 부분, 이미지 입력 등의 변화가 있으면 동작.

- line 378: document.getElementById("buttonRun").onclick  
?? 파일 넣기 동작 실행

- line 399: for (let k = 0; k < customFiles.length; k++) {}  
파일을 하나씩 밀어 넣기

- line 438: socket.emit("recv image file", {})  
이미지를 Flask로 보내기 

> __routes.py__
- line 66: @socketio.on('recv image file') ~
이미지 받아서 API로 보내는 부분

- line 96: res = requests.post()
API로 POST 요청 보내기

> __main.py__
- line 47: class Item(BaseModel)  
이런저런 정보 받는 클래스

- line 65: class Result(BaseModel)  
결과 Flask으로 보낼 때 클래스

> __routes.py__ 
- line 113: res = json.loads(res.text)  
API 결과인 res Flask로 부터 받음 

- line 128: socketio.emit('send image file', res)  
받은 결과 하나씩 완료될 때마다 브라우저(JS)로 전송

> __custom.js__
- line 43: socket.on("send iamge file", function (msg) {})  
브라우저에서 Flask에서 보낸 결과 받기

> __routes.py__
- line 129: socketio.emit('state', {"state": "done", "sid": session["sid"]})  
분석 요청 반복문 다 끝났다고 브라우저로 전송  