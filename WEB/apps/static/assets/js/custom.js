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

const lgchem_logo_base64 = "data:image/;base64," + 'iVBORw0KGgoAAAANSUhEUgAABX0AAAFtCAYAAAEscfneAAAACXBIWXMAAC4JAAAuIwF4pT92'