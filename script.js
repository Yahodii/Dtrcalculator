import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
const { jsPDF } = window.jspdf;

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA-lnFWi1w8ZEYjz_PMYgpNBMTrtqkXiRg",
  authDomain: "dtrattendance-2c2e3.firebaseapp.com",
  projectId: "dtrattendance-2c2e3",
  storageBucket: "dtrattendance-2c2e3.firebasestorage.app",
  messagingSenderId: "647610599705",
  appId: "1:647610599705:web:b47cb37f4c03bedbc01d88"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let currentUser=null;

let userFullName = "";
let userCourse = "";
let userSchool = "";

// ---------------- LOGIN / REGISTER ----------------
window.register = async function(){

  const fullName = document.getElementById("registerFullName").value.trim();
  const course = document.getElementById("registerCourse").value.trim();
  const school = document.getElementById("registerSchool").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;

  const msg = document.getElementById("registerMsg");

  if(!fullName || !course || !school || !username || !password){
      msg.textContent="Please fill all fields";
      return;
  }

  const userRef = doc(db,"users",username);
  const snap = await getDoc(userRef);

  if(snap.exists()){
      msg.textContent="Username already exists";
      return;
  }

  await setDoc(userRef,{
      fullName: fullName,
      course: course,
      school: school,
      password: password
  });

  msg.textContent="Registration successful!";

  document.getElementById("registerFullName").value="";
  document.getElementById("registerCourse").value="";
  document.getElementById("registerSchool").value="";
  document.getElementById("registerUsername").value="";
  document.getElementById("registerPassword").value="";

  setTimeout(()=>{
      document.getElementById("registerModal").style.display="none";
  },1000);

};

window.login = async function() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMsg");

    if(!username || !password){ msg.textContent="Enter username & password"; return; }

    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if(!userSnap.exists() || userSnap.data().password !== password){
        msg.textContent="Invalid username or password";
        return;
    }

    currentUser = username;
    const fullName = userSnap.data().fullName;

    document.getElementById("loginModal").style.display="none";
    document.getElementById("mainContainer").style.display="block";
    document.getElementById("welcomeMsg").textContent = `Welcome, ${fullName}`;
    loadTimesheet();
};

window.logout=function(){
  currentUser=null;
  document.getElementById("loginModal").style.display="flex";
  document.getElementById("mainContainer").style.display="none";
};
window.showRegister=function(){ document.getElementById("registerModal").style.display="flex"; }
window.closeRegister=function(){ document.getElementById("registerModal").style.display="none"; }

// ---------------- TIMESHEET ----------------
function timeToMinutes(time){ if(!time) return 0; const [h,m]=time.split(":").map(Number); return isNaN(h)||isNaN(m)?0:h*60+m; }
function minutesToTime(mins){ const h=Math.floor(mins/60); const m=mins%60; return `${h}:${m.toString().padStart(2,'0')}`; }
function calculateRow(row){ 
    const inputs=row.querySelectorAll(".time-input"); 
    const totalCell=row.querySelector(".total-cell"); 
    let total=0; 
    const morning=timeToMinutes(inputs[1].value)-timeToMinutes(inputs[0].value); 
    const afternoon=timeToMinutes(inputs[3].value)-timeToMinutes(inputs[2].value); 
    if(morning>0) total+=morning; 
    if(afternoon>0) total+=afternoon; 
    totalCell.textContent=minutesToTime(total); 
    updateSummary();
}
function updateSummary(){
    let grandTotal=0;
    document.querySelectorAll(".total-cell").forEach(c=>{ const [h,m]=c.textContent.split(":").map(Number); grandTotal+=h*60+m;});
    const target=parseFloat(document.getElementById("targetHours").value)||0;
    const targetMinutes=target*60;
    document.getElementById("totalHours").textContent=minutesToTime(grandTotal);
    document.getElementById("remainingHours").textContent=minutesToTime(Math.max(targetMinutes-grandTotal,0));

    // Update progress bar
    const percent = targetMinutes ? Math.min((grandTotal/targetMinutes)*100,100) : 0;
    document.getElementById("progressBar").style.width=`${percent}%`;
    document.getElementById("progressText").textContent = `${percent.toFixed(1)}% completed`;
}

window.addRow=function(data={}){ 
    const tableBody=document.getElementById("tableBody"); 
    const row=document.createElement("tr"); 
    row.innerHTML=`<td><input type="date" value="${data.date||''}"></td>
<td><input type="time" class="time-input" value="${data.morningIn||''}"></td>
<td><input type="time" class="time-input" value="${data.morningOut||''}"></td>
<td><input type="time" class="time-input" value="${data.afternoonIn||''}"></td>
<td><input type="time" class="time-input" value="${data.afternoonOut||''}"></td>
<td class="total-cell">0:00</td>`; 
    row.querySelectorAll(".time-input").forEach(input=>{input.addEventListener("input",()=>calculateRow(row));}); 
    tableBody.appendChild(row); 
    calculateRow(row);
}
document.getElementById("targetHours").addEventListener("input", updateSummary);

// ---------------- FIRESTORE TIMESHEET ----------------
window.saveTimesheet=async function(){
    if(!currentUser){ alert("Not logged in"); return;}
    const rows=document.querySelectorAll("#tableBody tr");
    let data=[];
    rows.forEach(row=>{
        const inputs=row.querySelectorAll("input");
        data.push({
            date:inputs[0].value,
            morningIn:inputs[1].value,
            morningOut:inputs[2].value,
            afternoonIn:inputs[3].value,
            afternoonOut:inputs[4].value
        });
    });
    await addDoc(collection(db,"users",currentUser,"timesheets"),{
        targetHours:document.getElementById("targetHours").value,
        rows:data,
        createdAt:new Date()
    });
    alert("Saved!");
};

window.loadTimesheet=async function(){
    if(!currentUser) return;
    const timesheetsCol=collection(db,"users",currentUser,"timesheets");
    const q=query(timesheetsCol, orderBy("createdAt","desc"), limit(1));
    const snapshot=await getDocs(q);
    document.getElementById("tableBody").innerHTML="";
    if(!snapshot.empty){
        const docData=snapshot.docs[0].data();
        document.getElementById("targetHours").value=docData.targetHours;
        docData.rows.forEach(r=>addRow(r));
    } else {
        addRow(); // new user → empty row
    }
}

// ---------------- EXPORT PDF ----------------
window.exportPDF = async function(){

    if(!currentUser){
        alert("Please login first");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Get user data
    const userRef = doc(db,"users",currentUser);
    const snap = await getDoc(userRef);

    let name = "";
    let course = "";
    let school = "";

    if(snap.exists()){
        const data = snap.data();
        name = data.fullName || "";
        course = data.course || "";
        school = data.school || "";
    }

    const totalHours = document.getElementById("totalHours").textContent;
    const remainingHours = document.getElementById("remainingHours").textContent;
    const targetHours = document.getElementById("targetHours").value;

    let rows = [];

    document.querySelectorAll("#tableBody tr").forEach(row=>{
        const inputs = row.querySelectorAll("input");
        const total = row.querySelector(".total-cell").textContent;

        rows.push([
            inputs[0].value,
            inputs[1].value,
            inputs[2].value,
            inputs[3].value,
            inputs[4].value,
            total
        ]);
    });

    pdf.setFontSize(18);
    pdf.text("STI OJT Daily Time Record",105,20,null,null,"center");

    pdf.setFontSize(12);
    pdf.text("Name: " + name,20,40);
    pdf.text("Course: " + course,20,48);
    pdf.text("School: " + school,20,56);

    pdf.text("Target Hours: " + targetHours,140,40);
    pdf.text("Total Hours: " + totalHours,140,48);
    pdf.text("Remaining Hours: " + remainingHours,140,56);

    pdf.autoTable({
        startY:70,
        head:[["Date","Morning In","Morning Out","Afternoon In","Afternoon Out","Total"]],
        body:rows
    });

    pdf.save("STI-OJT-DTR.pdf");
};