// Some restricted Windows runners cannot query the OS account for shell detection.
const os=require('node:os');
const original=os.userInfo;
try{original();}catch(error){if(error.code!=='ERR_SYSTEM_ERROR')throw error;os.userInfo=()=>({username:process.env.USERNAME||'builder',homedir:os.homedir(),shell:process.env.COMSPEC||'cmd.exe',uid:-1,gid:-1});}
require('../node_modules/@capacitor/cli/bin/capacitor');
