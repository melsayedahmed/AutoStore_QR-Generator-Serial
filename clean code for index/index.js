window.addEventListener('load', () => {
  document.body.classList.add('loaded');
});

// Mobile menu toggle
const btn = document.getElementById('mobile-menu-button');
const menu = document.getElementById('mobile-menu');
btn.addEventListener('click', () => menu.classList.toggle('hidden'));
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => menu.classList.add('hidden')));

// ---- QR Generator Config ----
const LOGO_PATH = "src/Logo.png";
const QR_CANVAS_SIZE = 150;
const REPEAT_PER_SERIAL = 5;
const SERIALS_PER_PDF = 20;
const QR_PER_ROW = 5;

let loadedSerials = [];
let generatedItems = [];

const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('loadBtn');
const clearBtn = document.getElementById('clearBtn');
const generateBtn = document.getElementById('generateBtn');
const previewBtn = document.getElementById('previewBtn');
const textarea = document.getElementById('textareaSerials');
const fileInfo = document.getElementById('fileInfo');
const progressEl = document.getElementById('progress');
const previewContainer = document.getElementById('previewContainer');
const logoWidthRatioInput = document.getElementById('logoWidthRatio');
const logoHeightRatioInput = document.getElementById('logoHeightRatio');
const resetLogoSizeBtn = document.getElementById('resetLogoSizeBtn');

logoWidthRatioInput.value = localStorage.getItem('logoWidthRatio') || '0.25';
logoHeightRatioInput.value = localStorage.getItem('logoHeightRatio') || '0.15';

resetLogoSizeBtn.addEventListener('click', () => {
  logoWidthRatioInput.value = '0.25';
  logoHeightRatioInput.value = '0.15';
  localStorage.removeItem('logoWidthRatio');
  localStorage.removeItem('logoHeightRatio');
  alert('Logo size ratios reset to default (25% width, 15% height).');
});

logoWidthRatioInput.addEventListener('change', () => {
  localStorage.setItem('logoWidthRatio', logoWidthRatioInput.value);
});
logoHeightRatioInput.addEventListener('change', () => {
  localStorage.setItem('logoHeightRatio', logoHeightRatioInput.value);
});

// --- Helpers ---
function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

function readCSVTextToSerials(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => line.split(',')[0].trim()).filter(Boolean);
}

function readCSVFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const serials = readCSVTextToSerials(e.target.result);
        resolve(serials);
      } catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readExcelFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header:1 });
        const serials = rows.map(r=>r[0]).filter(Boolean).map(String);
        resolve(serials);
      } catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function chunkArray(arr, size){
  const res = [];
  for(let i=0;i<arr.length;i+=size) res.push(arr.slice(i,i+size));
  return res;
}

function loadImage(src){
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>res(img);
    img.onerror=rej;
    img.src=src;
  });
}

// --- File load ---
loadBtn.addEventListener('click', async ()=>{
  if(!fileInput.files.length){ alert('Please select a file first.'); return; }
  const file = fileInput.files[0];
  fileInfo.textContent = `Loading ${file.name}...`;
  try {
    let serials = [];
    const name = file.name.toLowerCase();
    if(name.endsWith('.csv')) serials = await readCSVFile(file);
    else if(name.endsWith('.xlsx') || name.endsWith('.xls')) serials = await readExcelFile(file);
    else { alert('Unsupported file type.'); fileInfo.textContent=''; return; }
    loadedSerials = serials;
    fileInfo.textContent = `Loaded ${serials.length} serial(s) from ${file.name}`;
  } catch(err){
    console.error(err);
    alert('Failed to read file.');
    fileInfo.textContent='';
  }
});

// Clear
clearBtn.addEventListener('click', ()=>{
  textarea.value=''; fileInput.value=''; loadedSerials=[];
  fileInfo.textContent=''; previewContainer.innerHTML='';
  generatedItems=[]; progressEl.textContent='';
});

// Preview
previewBtn.addEventListener('click', ()=>prepareSerialsAndGenerate(false));

// Generate ZIP
generateBtn.addEventListener('click', ()=>prepareSerialsAndGenerate(true));

// --- Main ---
async function prepareSerialsAndGenerate(shouldZip){
  let serials = [];
  const text = textarea.value.trim();
  if(text) serials = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  else if(loadedSerials.length) serials = [...loadedSerials];
  if(!serials.length){ alert('No serials provided.'); return; }

  previewContainer.innerHTML='';
  generatedItems=[];
  progressEl.textContent='Generating QR images...';

  let logoImg=null;
  try{ logoImg = await loadImage(LOGO_PATH); } catch(e){ logoImg=null; }

  for(let idx=0; idx<serials.length; idx++){
    const serial = String(serials[idx]);
    for(let r=0;r<REPEAT_PER_SERIAL;r++){
      const canvas=document.createElement('canvas');
      canvas.width=QR_CANVAS_SIZE; canvas.height=QR_CANVAS_SIZE;
      new QRious({ element:canvas, value:serial, size:QR_CANVAS_SIZE, background:'white', foreground:'black' });

      if(logoImg){
        const ctx = canvas.getContext('2d');
        let widthRatio = Math.max(0.05, Math.min(0.9, parseFloat(logoWidthRatioInput.value)||0.25));
        let heightRatio = Math.max(0.05, Math.min(0.9, parseFloat(logoHeightRatioInput.value)||0.15));
        const logoWidth = Math.round(canvas.width*widthRatio);
        const logoHeight = Math.round(canvas.height*heightRatio);
        const x = Math.round((canvas.width-logoWidth)/2);
        const y = Math.round((canvas.height-logoHeight)/2);
        ctx.fillStyle="white";
        ctx.fillRect(x-2, y-2, logoWidth+4, logoHeight+4);
        ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
      }

      const dataUrl = canvas.toDataURL("image/png");
      generatedItems.push({serial, dataUrl});

      if(previewContainer.childElementCount<200){
        const card = document.createElement('div');
        card.className="bg-white p-2 border rounded-md flex flex-col items-center";
        const img = document.createElement('img'); img.src=dataUrl; img.width=100; img.height=100;
        const span = document.createElement('div'); span.className='text-xs mt-1 text-center'; span.textContent=serial;
        card.appendChild(img); card.appendChild(span); previewContainer.appendChild(card);
      }
    }
    progressEl.textContent=`Prepared ${idx+1}/${serials.length} serials`;
    await sleep(0);
  }

  progressEl.textContent=`Prepared images: ${generatedItems.length}`;

  if(!shouldZip) return;

  const imagesPerPdf = SERIALS_PER_PDF*REPEAT_PER_SERIAL;
  const chunks = chunkArray(generatedItems, imagesPerPdf);
  const zip = new JSZip();
  const { jsPDF } = window.jspdf;
  const totalParts = chunks.length;
  progressEl.textContent=`Creating ${chunks.length} PDF(s) and packaging into ZIP...`;

  for(let p=0; p<chunks.length; p++){
    const chunk = chunks[p];
    const pdf = new jsPDF('l','mm','a4');
    const qrSizeMM = 40;
    const perRow = QR_PER_ROW;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const spacingX = (pageWidth-(qrSizeMM*perRow))/(perRow+1);
    let x=spacingX, y=20, count=0, pageIndex=1;

    for(let i=0;i<chunk.length;i++){
      const item = chunk[i];
      pdf.setDrawColor(0); pdf.setLineWidth(0.5);
      pdf.rect(x-2,y-2,qrSizeMM+4,qrSizeMM+10);
      try{ pdf.addImage(item.dataUrl,'PNG',x,y,qrSizeMM,qrSizeMM); } catch(e){ console.warn(e); }
      pdf.setFontSize(9); pdf.text(String(item.serial), x+qrSizeMM/2, y+qrSizeMM+6, {align:'center'});

      count++;
      if(count%perRow===0){ x=spacingX; y+=qrSizeMM+20; } else { x+=qrSizeMM+spacingX; }
      if(y+qrSizeMM>pdf.internal.pageSize.getHeight()-20){
        pdf.setFontSize(9);
        pdf.text(`Page ${pageIndex}`, pageWidth/2, pdf.internal.pageSize.getHeight()-8, {align:'center'});
        if(i<chunk.length-1){ pdf.addPage(); pageIndex++; x=spacingX; y=20; }
      }
    }

    pdf.setFontSize(9);
    pdf.text(`Part ${p+1} of ${totalParts}`, pageWidth/2, pdf.internal.pageSize.getHeight()-5, {align:'center'});
    zip.file(`qr_codes_part_${p+1}.pdf`, pdf.output('blob'));
    progressEl.textContent=`Created PDF ${p+1}/${chunks.length}`;
    await sleep(50);
  }

  progressEl.textContent='Generating ZIP...';
  const zipBlob = await zip.generateAsync({type:'blob'}, metadata=>{ progressEl.textContent=`Zipping... ${Math.round(metadata.percent)}%`; });
  saveAs(zipBlob,'qr_codes_all.zip');
  progressEl.textContent=`Done — downloaded qr_codes_all.zip (${chunks.length} PDFs)`;
}
