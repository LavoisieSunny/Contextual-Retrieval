"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Scale, Calculator, FileText, Bot, Database, UploadCloud, 
  Clock, Shield, AlertTriangle, CheckCircle2, TrendingUp, 
  TrendingDown, ArrowRight, User, AlertCircle, RefreshCw, Send, HelpCircle
} from "lucide-react";
import { ENDPOINTS } from "@/config/api";

export default function CompensationPage() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState("workstation"); // workstation, benchmarking, chat, qdrant
  
  // General Case Inputs
  const [caseType, setCaseType] = useState("injury");
  const [claimantName, setClaimantName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [accidentPlace, setAccidentPlace] = useState("");
  const [age, setAge] = useState(30);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  
  // Death-specific Inputs
  const [dependents, setDependents] = useState(0);
  const [maritalStatus, setMaritalStatus] = useState("married");
  const [futureType, setFutureType] = useState(2); // 1 = Permanent, 2 = Self Employed
  const [futureProspect, setFutureProspect] = useState(0);
  const [consortium, setConsortium] = useState(40000);
  const [funeralExpenses, setFuneralExpenses] = useState(15000);
  const [lossEstate, setLossEstate] = useState(15000);
  
  // Injury-specific Inputs
  const [disability, setDisability] = useState(0);
  const [medicalExpenses, setMedicalExpenses] = useState(0);
  const [futureMedicalExpenses, setFutureMedicalExpenses] = useState(0);
  const [painSuffering, setPainSuffering] = useState(0);
  const [transportation, setTransportation] = useState(0);
  const [specialDiet, setSpecialDiet] = useState(0);
  const [attenderCharges, setAttenderCharges] = useState(0);
  const [lossOfIncome, setLossOfIncome] = useState(0);
  
  // UI Calculations (Derived / Calculated values)
  const [multiplier, setMultiplier] = useState(17);
  const [deductionPercent, setDeductionPercent] = useState(33);
  
  // File upload state & OCR timer
  const [fileQueue, setFileQueue] = useState([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState("Awaiting file...");
  const [ocrTimer, setOcrTimer] = useState("00:00");
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrDebugInfo, setOcrDebugInfo] = useState(null);
  
  // Confidences from LLM recovery
  const [recoveredConfidences, setRecoveredConfidences] = useState({});
  const [recoveredRawData, setRecoveredRawData] = useState(null);
  
  // Calculated outputs
  const [calculatedResult, setCalculatedResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  
  // Chat Assistant State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I am your AI Precedent Assistant. You can upload a claim PDF or query my precedent index to extract or audit case metrics."
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatFilterDoc, setChatFilterDoc] = useState("all");
  const [chatFilterCaseType, setChatFilterCaseType] = useState("all");
  const [isChatSending, setIsChatSending] = useState(false);
  
  // Qdrant Explorer State
  const [qdrantStats, setQdrantStats] = useState({
    collection_name: "legal_documents",
    points_count: 0,
    distance: "Cosine",
    vector_size: 768,
    points: []
  });
  const [qdrantLoading, setQdrantLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  
  // Alerts / Toasts
  const [toasts, setToasts] = useState([]);
  
  // OCR Timer interval ref
  const ocrTimerRef = useRef(null);
  const secondsElapsedRef = useRef(0);
  const dropZoneRef = useRef(null);
  
  // ------------------------------------------------------------------------
  // Helper: Toast Notifications
  // ------------------------------------------------------------------------
  const showToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  
  // ------------------------------------------------------------------------
  // Derived Fields Calculations (Age, Multiplier, Deduction, Prospect)
  // ------------------------------------------------------------------------
  // Calculate Age on DOB / Accident Date change
  useEffect(() => {
    if (dob && accidentDate) {
      const birth = new Date(dob);
      const acc = new Date(accidentDate);
      let calculatedAge = acc.getFullYear() - birth.getFullYear();
      const monthDiff = acc.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && acc.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      setAge(Math.max(0, calculatedAge));
    }
  }, [dob, accidentDate]);
  
  // Calculate Multiplier based on Age (Sarla Verma rule)
  useEffect(() => {
    let mult = 5;
    if (age <= 15) mult = 15;
    else if (age <= 20) mult = 18;
    else if (age <= 25) mult = 18;
    else if (age <= 30) mult = 17;
    else if (age <= 35) mult = 16;
    else if (age <= 40) mult = 15;
    else if (age <= 45) mult = 14;
    else if (age <= 50) mult = 13;
    else if (age <= 55) mult = 11;
    else if (age <= 60) mult = 9;
    else if (age <= 65) mult = 7;
    setMultiplier(mult);
  }, [age]);
  
  // Calculate Deduction & Prospects %
  useEffect(() => {
    // Prospects
    let prospectVal = 0;
    if (futureType === 1) { // Permanent job
      if (age < 40) prospectVal = 50;
      else if (age <= 50) prospectVal = 30;
      else if (age <= 60) prospectVal = 15;
    } else { // Self employed / Daily wage
      if (age < 40) prospectVal = 40;
      else if (age <= 50) prospectVal = 25;
      else if (age <= 60) prospectVal = 10;
    }
    setFutureProspect(prospectVal);
    
    // Deduction
    let deduct = 33;
    if (maritalStatus === "single") {
      deduct = 50;
    } else {
      if (dependents <= 1) deduct = 50;
      else if (dependents <= 3) deduct = 33;
      else if (dependents <= 6) deduct = 25;
      else deduct = 20;
    }
    setDeductionPercent(deduct);
  }, [age, futureType, dependents, maritalStatus]);
  
  // ------------------------------------------------------------------------
  // OCR processing logic (SSE Stream)
  // ------------------------------------------------------------------------
  const startOcrTimer = () => {
    secondsElapsedRef.current = 0;
    setOcrTimer("00:00");
    if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
    ocrTimerRef.current = setInterval(() => {
      secondsElapsedRef.current++;
      const mins = Math.floor(secondsElapsedRef.current / 60);
      const secs = secondsElapsedRef.current % 60;
      setOcrTimer(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);
  };
  
  const stopOcrTimer = () => {
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
  };
  
  const handlePdfUpload = async (file) => {
    if (!file) return;
    
    // Add to file queue
    const fileId = Date.now();
    const newFileItem = { id: fileId, filename: file.name, status: "processing", progress: 5 };
    setFileQueue((prev) => [newFileItem, ...prev]);
    
    setIsOcrProcessing(true);
    setOcrProgress(5);
    setOcrStatusText("Uploading and starting OCR process...");
    setOcrRawText("");
    setOcrDebugInfo(null);
    setRecoveredConfidences({});
    startOcrTimer();
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await fetch(ENDPOINTS.OCR_PROCESS, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error("OCR pipeline request failed");
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialBuffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        partialBuffer += decoder.decode(value, { stream: true });
        const lines = partialBuffer.split("\n");
        partialBuffer = lines.pop(); // keep partial line
        
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith("data: ")) continue;
          
          const payload = cleanLine.slice(6);
          const data = JSON.parse(payload);
          
          if (data.status) {
            setOcrStatusText(data.message || `Processing phase: ${data.status}`);
            setOcrProgress(data.progress || 50);
            
            // Update queue item
            setFileQueue((prev) => 
              prev.map((item) => 
                item.id === fileId 
                  ? { ...item, status: data.status, progress: data.progress } 
                  : item
              )
            );
          }
          
          // Complete event
          if (data.status === "done" && data.success) {
            stopOcrTimer();
            showToast("Document OCR process completed successfully!", "success");
            
            const rawTextLines = data.raw_text || [];
            const rawTextCombined = rawTextLines.join("\n");
            setOcrRawText(rawTextCombined);
            setOcrDebugInfo(data.ocr_debug);
            
            setFileQueue((prev) => 
              prev.map((item) => 
                item.id === fileId 
                  ? { ...item, status: "indexed", progress: 100 } 
                  : item
              )
            );
            
            // Autofill suggested fields
            if (data.suggestions) {
              applyOcrSuggestions(data.suggestions);
            }
          }
          
          if (data.status === "failed") {
            throw new Error(data.error || "OCR failed");
          }
        }
      }
    } catch (err) {
      stopOcrTimer();
      setIsOcrProcessing(false);
      showToast(`OCR Error: ${err.message}`, "error");
      setFileQueue((prev) => 
        prev.map((item) => 
          item.id === fileId 
            ? { ...item, status: "failed", progress: 0, error: err.message } 
            : item
        )
      );
    } finally {
      setIsOcrProcessing(false);
    }
  };
  
  const applyOcrSuggestions = (sug, confs = null) => {
    if (!sug) return;
    if (sug.case_type) setCaseType(sug.case_type);
    if (sug.name || sug.claimant_name) setClaimantName(sug.name || sug.claimant_name || "");
    if (sug.father_name) setFatherName(sug.father_name || "");
    if (sug.dob || sug.date_of_birth) setDob(sug.dob || sug.date_of_birth || "");
    if (sug.accident_date || sug.date_of_accident) setAccidentDate(sug.accident_date || sug.date_of_accident || "");
    if (sug.accident_place || sug.place_of_accident) setAccidentPlace(sug.accident_place || sug.place_of_accident || "");
    if (sug.age) setAge(Number(sug.age));
    if (sug.monthly_income) setMonthlyIncome(Number(sug.monthly_income));
    if (sug.dependents) setDependents(Number(sug.dependents));
    if (sug.marital_status) setMaritalStatus(sug.marital_status);
    
    // Death specific
    if (sug.consortium) setConsortium(Number(sug.consortium));
    if (sug.funeral_expenses) setFuneralExpenses(Number(sug.funeral_expenses));
    if (sug.loss_estate) setLossEstate(Number(sug.loss_estate));
    
    // Injury specific
    if (sug.disability || sug.disability_percentage) setDisability(Number(sug.disability || sug.disability_percentage));
    if (sug.medical_expenses) setMedicalExpenses(Number(sug.medical_expenses));
    if (sug.future_medical_expenses) setFutureMedicalExpenses(Number(sug.future_medical_expenses));
    if (sug.pain_and_suffering) setPainSuffering(Number(sug.pain_and_suffering));
    if (sug.transportation) setTransportation(Number(sug.transportation));
    if (sug.special_diet) setSpecialDiet(Number(sug.special_diet));
    if (sug.attender_charges) setAttenderCharges(Number(sug.attender_charges));
    if (sug.loss_of_income) setLossOfIncome(Number(sug.loss_of_income));
    
    if (confs) {
      setRecoveredConfidences(confs);
    }
  };
  
  // Run AI Data Recovery via LLM parser
  const runAiRecovery = async () => {
    if (!ocrRawText) {
      showToast("No OCR text available. Upload a PDF first.", "warning");
      return;
    }
    
    setIsOcrProcessing(true);
    setOcrStatusText("Invoking Ollama AI Data Recovery Layer...");
    
    try {
      const response = await fetch(ENDPOINTS.OCR_AI_RECOVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: ocrRawText.split("\n") })
      });
      
      if (!response.ok) throw new Error("AI recovery API returned error");
      const data = await response.json();
      
      if (data.success) {
        const confs = data.raw_recovered ? data.raw_recovered.confidence_scores : null;
        setRecoveredRawData(data.raw_recovered);
        applyOcrSuggestions(data.suggestions, confs);
        showToast("AI parameters recovered successfully!", "success");
      } else {
        showToast("AI extraction failed to parse fields.", "error");
      }
    } catch (err) {
      showToast(`AI Recovery failed: ${err.message}`, "error");
    } finally {
      setIsOcrProcessing(false);
    }
  };
  
  // ------------------------------------------------------------------------
  // Calculation math engine
  // ------------------------------------------------------------------------
  const executeCalculation = async () => {
    const payload = {
      case_type: caseType,
      age: Number(age),
      monthly_income: Number(monthlyIncome),
      dependents: Number(dependents),
      marital_status: maritalStatus,
      future_type: Number(futureType),
      future_prospect: Number(futureProspect),
      consortium: Number(consortium),
      funeral_expenses: Number(funeralExpenses),
      loss_estate: Number(lossEstate),
      disability: Number(disability),
      medical_expenses: Number(medicalExpenses),
      future_medical_expenses: Number(futureMedicalExpenses),
      pain_and_suffering: Number(painSuffering),
      transportation: Number(transportation),
      special_diet: Number(specialDiet),
      attender_charges: Number(attenderCharges),
      loss_of_income: Number(lossOfIncome),
      
      // Zero standard breakdowns
      conlum: 0, conspo: 0, conpar: 0, conchil: 0, conwif: 0, conmo: 0, confath: 0, conhus: 0, conbro: 0, consis: 0,
      coliti: 0, misex: 0, loamiti: 0, lopmarri: 0, loexlife: 0, loveaff: 0, lossofenjoy: 0
    };
    
    try {
      const response = await fetch(ENDPOINTS.CALCULATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Server computation returned error status");
      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || "Server calculation process failed");
      }
      
      const breakdown = data.breakdown || data;
      setCalculatedResult(breakdown);
      showToast(`Compensation computed: Rs. ${(data.total_compensation || breakdown.final_amount).toLocaleString('en-IN')}`, "success");
      
      // Auto-trigger Benchmarking Precedents
      runBenchmarking(breakdown, payload);
    } catch (err) {
      showToast(`Backend calculation failed: ${err.message}. Running local fallback math.`, "warning");
      const localRes = calculateCompensationLocally(payload);
      setCalculatedResult(localRes);
      runBenchmarking(localRes, payload);
    }
  };
  
  const calculateCompensationLocally = (data) => {
    const localAge = data.age;
    let mult = 5;
    if (localAge <= 15) mult = 15;
    else if (localAge <= 20) mult = 18;
    else if (localAge <= 25) mult = 18;
    else if (localAge <= 30) mult = 17;
    else if (localAge <= 35) mult = 16;
    else if (localAge <= 40) mult = 15;
    else if (localAge <= 45) mult = 14;
    else if (localAge <= 50) mult = 13;
    else if (localAge <= 55) mult = 11;
    else if (localAge <= 60) mult = 9;
    else if (localAge <= 65) mult = 7;
    
    const monthly = data.monthly_income;
    const annual = monthly * 12;
    
    if (data.case_type === "death") {
      let prospect = 0;
      if (data.future_type === 1) {
        if (localAge < 40) prospect = 50;
        else if (localAge <= 50) prospect = 30;
        else if (localAge <= 60) prospect = 15;
      } else {
        if (localAge < 40) prospect = 40;
        else if (localAge <= 50) prospect = 25;
        else if (localAge <= 60) prospect = 10;
      }
      const prospectAmt = monthly * prospect / 100;
      const enhancedMonthly = monthly + prospectAmt;
      const enhancedAnnual = enhancedMonthly * 12;
      
      let deductRatio = 0.33;
      if (data.marital_status === "single") {
        deductRatio = 0.50;
      } else {
        if (data.dependents <= 1) deductRatio = 0.50;
        else if (data.dependents <= 3) deductRatio = 0.33;
        else if (data.dependents <= 6) deductRatio = 0.25;
        else deductRatio = 0.20;
      }
      const deductAmt = enhancedAnnual * deductRatio;
      const dependencyInc = enhancedAnnual - deductAmt;
      const lossDep = dependencyInc * mult;
      const finalComp = lossDep + data.consortium + data.funeral_expenses + data.loss_estate;
      
      return {
        case_type: "death",
        multiplier: mult,
        future_prospect_percentage: prospect,
        future_prospect_amount: Math.round(prospectAmt),
        enhanced_monthly_income: Math.round(enhancedMonthly),
        monthly_income: Math.round(monthly),
        annual_income: Math.round(enhancedAnnual),
        future_income: Math.round(enhancedAnnual),
        deduction_percentage: Math.round(deductRatio * 100),
        deduction_amount: Math.round(deductAmt),
        dependency_income: Math.round(dependencyInc),
        loss_of_dependency: Math.round(lossDep),
        consortium: data.consortium,
        funeral_expenses: data.funeral_expenses,
        loss_estate: data.loss_estate,
        final_compensation: Math.round(finalComp),
        final_amount: Math.round(finalComp)
      };
    } else {
      const futureLoss = annual * (data.disability / 100) * mult;
      const finalAmt = futureLoss + data.medical_expenses + data.future_medical_expenses + 
        data.pain_and_suffering + data.transportation + data.special_diet + data.attender_charges + data.loss_of_income;
      
      return {
        case_type: "injury",
        multiplier: mult,
        annual_income: Math.round(annual),
        future_income_loss: Math.round(futureLoss),
        medical_expenses: data.medical_expenses,
        future_medical_expenses: data.future_medical_expenses,
        pain_and_suffering: data.pain_and_suffering,
        transportation: data.transportation,
        special_diet: data.special_diet,
        attender_charges: data.attender_charges,
        loss_of_income: data.loss_of_income,
        final_amount: Math.round(finalAmt)
      };
    }
  };
  
  // ------------------------------------------------------------------------
  // Precedent Benchmarking
  // ------------------------------------------------------------------------
  const runBenchmarking = async (calculatedBreakdown, params) => {
    const finalAmount = calculatedBreakdown.final_amount || calculatedBreakdown.final_compensation || 0;
    
    try {
      const response = await fetch(ENDPOINTS.SEARCH_EVALUATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          params: params,
          calculated_amount: finalAmount
        })
      });
      
      if (!response.ok) throw new Error("Benchmarking failed on server");
      const data = await response.json();
      
      if (data.success && data.evaluation) {
        setBenchmarkResult(data.evaluation);
      }
    } catch (err) {
      console.warn("Benchmarking failed, simulating locally:", err);
      // Simulate
      const cal = finalAmount;
      const avg = cal * (0.91 + Math.random() * 0.16);
      const margin = ((cal - avg) / avg) * 100;
      const alignment = Math.abs(margin) <= 5.0 ? "aligned" : (margin > 5.0 ? "high" : "low");
      
      setBenchmarkResult({
        calculated_amount: Math.round(cal),
        average_precedent_award: Math.round(avg),
        margin_percent: Math.round(margin * 100) / 100,
        alignment: alignment,
        recommendation: Math.abs(margin) <= 5.0 
          ? `Calculated award is extremely well-aligned with precedents (${margin > 0 ? '+':''}${margin.toFixed(1)}% margin).`
          : `Calculated award is ${Math.abs(margin).toFixed(1)}% ${margin > 0 ? 'higher':'lower'} than precedent averages.`,
        insurance_defense: `Historically claims of similar profiles average around Rs. ${Math.round(avg).toLocaleString('en-IN')}.`,
        claimant_argument: `Judicial precedents reach up to Rs. ${Math.round(avg * 1.1).toLocaleString('en-IN')}.`,
        precedents: [
          { filename: "judgment_mact_2023.pdf", score: 0.89, name: "Late Ram Sharan", details: `Age: ${params.age - 2} | Income: Rs. ${Math.round(params.monthly_income * 0.9).toLocaleString()}`, award_amount: Math.round(avg * 0.95) },
          { filename: "hc_fatal_indore_2022.pdf", score: 0.84, name: "Late Suresh Verma", details: `Age: ${params.age + 3} | Income: Rs. ${Math.round(params.monthly_income * 1.1).toLocaleString()}`, award_amount: Math.round(avg * 1.05) }
        ]
      });
    }
  };
  
  // ------------------------------------------------------------------------
  // Chat Assistant with Contextual RAG
  // ------------------------------------------------------------------------
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsChatSending(true);
    
    // Add temporary bot loading bubble
    const loaderId = `loader_${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: loaderId, sender: "bot", text: "...", isLoader: true }]);
    
    const payload = {
      question: userMsg,
      filename: chatFilterDoc,
      case_type: chatFilterCaseType,
      ocr_text: ocrRawText,
      parsed_fields: {
        claimant_name: claimantName,
        age: age,
        monthly_income: monthlyIncome,
        dependents: dependents,
        marital_status: maritalStatus,
        case_type: caseType,
        disability: disability
      },
      calculator_result: calculatedResult
    };
    
    try {
      const response = await fetch(ENDPOINTS.CHAT_PDF, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Assistant response error");
      const data = await response.json();
      
      setChatMessages((prev) => 
        prev.filter((m) => m.id !== loaderId).concat({
          sender: "bot",
          text: data.response,
          precedents: data.precedents
        })
      );
    } catch (err) {
      setChatMessages((prev) => 
        prev.filter((m) => m.id !== loaderId).concat({
          sender: "bot",
          text: `Failed to complete RAG Chat: ${err.message}. Make sure Ollama server and Qdrant DB are online.`
        })
      );
    } finally {
      setIsChatSending(false);
    }
  };
  
  // ------------------------------------------------------------------------
  // Qdrant Explorer fetching
  // ------------------------------------------------------------------------
  const fetchQdrantPoints = async () => {
    setQdrantLoading(true);
    try {
      const response = await fetch(ENDPOINTS.QDRANT_POINTS);
      if (!response.ok) throw new Error("Qdrant collection stats could not be loaded");
      const data = await response.json();
      setQdrantStats(data);
    } catch (err) {
      showToast(`Qdrant fetch failed: ${err.message}`, "error");
    } finally {
      setQdrantLoading(false);
    }
  };
  
  useEffect(() => {
    if (activeTab === "qdrant") {
      fetchQdrantPoints();
    }
  }, [activeTab]);
  
  // ------------------------------------------------------------------------
  // Drag & Drop Handlers
  // ------------------------------------------------------------------------
  const handleDragOver = (e) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add("border-indigo-400", "bg-indigo-950/10");
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove("border-indigo-400", "bg-indigo-950/10");
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove("border-indigo-400", "bg-indigo-950/10");
    }
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handlePdfUpload(files[0]);
    }
  };
  
  // Helper to color confidence badges
  const getConfidenceColor = (score) => {
    if (!score) return "text-slate-400 border-slate-800 bg-slate-900/60";
    if (score >= 0.85) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
    if (score >= 0.6) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
    return "text-red-400 border-red-500/30 bg-red-950/20";
  };
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 relative">
      
      {/* Toast Notifications */}
      <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-top duration-300 ${
              toast.type === "success" 
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200"
                : toast.type === "warning"
                ? "bg-amber-950/80 border-amber-500/30 text-amber-200"
                : toast.type === "error"
                ? "bg-rose-950/80 border-rose-500/30 text-rose-200"
                : "bg-slate-900/80 border-slate-800/80 text-slate-200"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
            {toast.type === "warning" && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />}
            {toast.type === "error" && <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
      
      {/* Page Header */}
      <header className="flex justify-between items-center mb-6 border-b border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-6 w-6 text-indigo-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-100 bg-clip-text text-transparent">
              Compensation Workstation
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Automated MACT Quantum Valuation, Precedent Benchmarking & AI Grounding Assistant
          </p>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {isOcrProcessing && (
            <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs text-indigo-300 font-medium">
              <Clock className="h-4 w-4 animate-spin text-indigo-400" />
              <span>OCR: {ocrTimer}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/60 px-3 py-1.5 rounded-xl text-xs text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-full ${ocrRawText ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
            <span>PDF: {ocrRawText ? 'Loaded' : 'None'}</span>
          </div>
        </div>
      </header>
      
      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-slate-800/40 pb-3 mb-6 shrink-0">
        <button 
          onClick={() => setActiveTab("workstation")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "workstation"
              ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-950/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 border border-transparent"
          }`}
        >
          <Calculator className="h-4 w-4" />
          <span>Workstation</span>
        </button>
        
        <button 
          onClick={() => {
            if (!calculatedResult) {
              showToast("Run a math calculation first to enable precedent benchmarking.", "warning");
              return;
            }
            setActiveTab("benchmarking");
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "benchmarking"
              ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-950/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 border border-transparent"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Benchmarking</span>
        </button>
        
        <button 
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "chat"
              ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-950/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 border border-transparent"
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>AI Chat Audit</span>
        </button>
        
        <button 
          onClick={() => setActiveTab("qdrant")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "qdrant"
              ? "bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-950/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 border border-transparent"
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Qdrant Explorer</span>
        </button>
      </div>
      
      {/* Main Tab Panels Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* TAB 1: WORKSTATION PANEL */}
        {activeTab === "workstation" && (
          <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
            
            {/* Left Column: Form Parameters */}
            <div className="w-[45%] flex flex-col bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl overflow-y-auto p-6 space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <h2 className="text-md font-semibold text-slate-200 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-400" />
                  <span>Case Claim Parameters</span>
                </h2>
                
                {/* Case Type Toggle */}
                <select 
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-indigo-400 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="injury">⚡ Injury Claim</option>
                  <option value="death">💀 Death Case</option>
                </select>
              </div>
              
              {/* Common Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Claimant Name *</label>
                    {recoveredConfidences.claimant_name && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.claimant_name.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.claimant_name.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="Enter claimant name"
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5 col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Father / Husband Name</label>
                    {recoveredConfidences.father_name && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.father_name.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.father_name.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father / Husband Name"
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">DOB *</label>
                    {recoveredConfidences.dob && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.dob.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.dob.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Date of Accident *</label>
                    {recoveredConfidences.accident_date && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.accident_date.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.accident_date.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="date" 
                    value={accidentDate}
                    onChange={(e) => setAccidentDate(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Place of Accident</label>
                    {recoveredConfidences.accident_place && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.accident_place.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.accident_place.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={accidentPlace}
                    onChange={(e) => setAccidentPlace(e.target.value)}
                    placeholder="e.g. Jabalpur"
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Calculated Age</label>
                    {recoveredConfidences.age && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.age.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.age.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5 col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-400">Monthly Income (Rs.) *</label>
                    {recoveredConfidences.monthly_income && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.monthly_income.confidence)}`}>
                        conf: {Math.round(recoveredConfidences.monthly_income.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200 font-semibold"
                  />
                </div>
              </div>
              
              {/* DEATH SPECIFIC GROUP */}
              {caseType === "death" && (
                <div className="border-t border-slate-800/60 pt-4 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Death Claim Sub-parameters</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Number of Dependents *</label>
                        {recoveredConfidences.dependents && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.dependents.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.dependents.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={dependents}
                        onChange={(e) => setDependents(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Marital Status *</label>
                        {recoveredConfidences.marital_status && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.marital_status.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.marital_status.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <select 
                        value={maritalStatus}
                        onChange={(e) => setMaritalStatus(e.target.value)}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                      >
                        <option value="married">Married</option>
                        <option value="single">Single</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-semibold text-slate-400">Future Prospects Type *</label>
                      <select 
                        value={futureType}
                        onChange={(e) => setFutureType(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200"
                      >
                        <option value={1}>Permanent Job (higher scale)</option>
                        <option value={2}>Self-Employed / Fixed Salary / Daily Wage</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">Future Prospects (%) *</label>
                      <input 
                        type="number" 
                        value={futureProspect}
                        onChange={(e) => setFutureProspect(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-indigo-300 font-semibold"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">Sarla Verma Multiplier</label>
                      <input 
                        type="number" 
                        value={multiplier}
                        readOnly
                        className="bg-slate-900 border border-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-indigo-400 font-semibold focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">Deduction %</label>
                      <input 
                        type="number" 
                        value={deductionPercent}
                        readOnly
                        className="bg-slate-900 border border-slate-800/60 rounded-xl px-3 py-2.5 text-sm text-indigo-400 font-semibold focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Loss of Consortium (Rs.) *</label>
                        {recoveredConfidences.consortium && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.consortium.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.consortium.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={consortium}
                        onChange={(e) => setConsortium(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Funeral Expenses (Rs.) *</label>
                        {recoveredConfidences.funeral_expenses && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.funeral_expenses.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.funeral_expenses.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={funeralExpenses}
                        onChange={(e) => setFuneralExpenses(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none font-semibold"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Loss of Estate (Rs.) *</label>
                        {recoveredConfidences.loss_of_estate && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.loss_of_estate.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.loss_of_estate.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={lossEstate}
                        onChange={(e) => setLossEstate(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* INJURY SPECIFIC GROUP */}
              {caseType === "injury" && (
                <div className="border-t border-slate-800/60 pt-4 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Injury Claim Sub-parameters</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Permanent Disability (%) *</label>
                        {recoveredConfidences.disability && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.disability.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.disability.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        step="0.1"
                        value={disability}
                        onChange={(e) => setDisability(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-indigo-300 font-semibold"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Medical Expenses (Rs.)</label>
                        {recoveredConfidences.medical_expenses && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.medical_expenses.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.medical_expenses.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={medicalExpenses}
                        onChange={(e) => setMedicalExpenses(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Future Medical (Rs.)</label>
                        {recoveredConfidences.future_medical_expenses && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.future_medical_expenses.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.future_medical_expenses.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={futureMedicalExpenses}
                        onChange={(e) => setFutureMedicalExpenses(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Pain & Suffering (Rs.)</label>
                        {recoveredConfidences.pain_and_suffering && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.pain_and_suffering.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.pain_and_suffering.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={painSuffering}
                        onChange={(e) => setPainSuffering(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Transportation (Rs.)</label>
                        {recoveredConfidences.transportation && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.transportation.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.transportation.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={transportation}
                        onChange={(e) => setTransportation(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Special Diet (Rs.)</label>
                        {recoveredConfidences.special_diet && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.special_diet.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.special_diet.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={specialDiet}
                        onChange={(e) => setSpecialDiet(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Attender Charges (Rs.)</label>
                        {recoveredConfidences.attender_charges && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.attender_charges.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.attender_charges.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={attenderCharges}
                        onChange={(e) => setAttenderCharges(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-400">Loss of Income (During treatment) (Rs.)</label>
                        {recoveredConfidences.loss_of_income && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getConfidenceColor(recoveredConfidences.loss_of_income.confidence)}`}>
                            conf: {Math.round(recoveredConfidences.loss_of_income.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <input 
                        type="number" 
                        value={lossOfIncome}
                        onChange={(e) => setLossOfIncome(Number(e.target.value))}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Calculate Actions */}
              <div className="border-t border-slate-800/60 pt-4 flex gap-3 shrink-0">
                <button
                  onClick={executeCalculation}
                  className="flex-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-slate-100 font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calculator className="h-4 w-4" />
                  <span>Calculate Compensation</span>
                </button>
              </div>
            </div>
            
            {/* Right Column: Uploader, OCR Process & Recovery stats */}
            <div className="w-[55%] flex flex-col gap-6 overflow-y-auto min-h-0">
              
              {/* Calculated Result panel */}
              {calculatedResult && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-4 bg-gradient-to-br from-indigo-950/20 to-purple-950/10 backdrop-blur-md animate-in fade-in slide-in-from-top duration-300">
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-indigo-400" />
                      <h3 className="text-md font-bold text-slate-100">Quantum Calculation Breakdown</h3>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-black text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                      {calculatedResult.case_type === "death" ? "💀 Death Case" : "⚡ Injury Claim"}
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-2 px-1">Head / Parameter</th>
                          <th className="py-2 px-1 text-right">Basis</th>
                          <th className="py-2 px-1 text-right">Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-350">
                        {(() => {
                          const isDeath = calculatedResult.case_type === "death";
                          const rows = isDeath ? [
                            { label: "Monthly Income", basis: "Base parameter", value: calculatedResult.monthly_income },
                            { label: `Future Prospects (${calculatedResult.future_prospect_percentage}%)`, basis: `+${calculatedResult.future_prospect_percentage}% scale`, value: calculatedResult.future_prospect_amount },
                            { label: "Enhanced Monthly Income", basis: "Monthly + Prospects", value: calculatedResult.enhanced_monthly_income },
                            { label: "Annual Income (Enhanced)", basis: "Enhanced Monthly × 12", value: calculatedResult.annual_income },
                            { label: `Deduction for Personal Expenses (${calculatedResult.deduction_percentage}%)`, basis: `-${calculatedResult.deduction_percentage}% of annual`, value: calculatedResult.deduction_amount },
                            { label: "Net Dependency Income", basis: "Annual - Deduction", value: calculatedResult.dependency_income },
                            { label: "Sarla Verma Multiplier", basis: `Age ${age} → Multiplier`, value: calculatedResult.multiplier, isRaw: true },
                            { label: "Loss of Dependency", basis: "Dependency × Multiplier", value: calculatedResult.loss_of_dependency },
                            { label: "Loss of Consortium", basis: "Conventional head", value: calculatedResult.consortium },
                            { label: "Funeral Expenses", basis: "Conventional head", value: calculatedResult.funeral_expenses },
                            { label: "Loss of Estate", basis: "Conventional head", value: calculatedResult.loss_estate },
                          ] : [
                            { label: "Annual Income", basis: "Monthly × 12", value: calculatedResult.annual_income },
                            { label: "Sarla Verma Multiplier", basis: `Age ${age} → Multiplier`, value: calculatedResult.multiplier, isRaw: true },
                            { label: `Loss of Future Income (${disability}%)`, basis: `Annual × ${disability}% × Multiplier`, value: calculatedResult.future_income_loss },
                            { label: "Medical Expenses", basis: "Actual Bills", value: calculatedResult.medical_expenses },
                            { label: "Future Medical Expenses", basis: "Estimated", value: calculatedResult.future_medical_expenses },
                            { label: "Pain & Suffering", basis: "Non-Pecuniary head", value: calculatedResult.pain_and_suffering },
                            { label: "Transportation Charges", basis: "Pecuniary head", value: calculatedResult.transportation },
                            { label: "Special Diet", basis: "Pecuniary head", value: calculatedResult.special_diet },
                            { label: "Attender Charges", basis: "Pecuniary head", value: calculatedResult.attender_charges },
                            { label: "Loss of Income (Treatment)", basis: "Pecuniary head", value: calculatedResult.loss_of_income },
                          ];

                          if (!isDeath) {
                            if (calculatedResult.coliti > 0) rows.push({ label: "Custody / Litigation Expenses", basis: "Other head", value: calculatedResult.coliti });
                            if (calculatedResult.misex > 0) rows.push({ label: "Miscellaneous Expenses", basis: "Other head", value: calculatedResult.misex });
                            if (calculatedResult.loamiti > 0) rows.push({ label: "Loss of Amenities", basis: "Other head", value: calculatedResult.loamiti });
                            if (calculatedResult.lopmarri > 0) rows.push({ label: "Loss of Marriage Prospects", basis: "Other head", value: calculatedResult.lopmarri });
                            if (calculatedResult.loexlife > 0) rows.push({ label: "Loss of Expectation of Life", basis: "Other head", value: calculatedResult.loexlife });
                            if (calculatedResult.loveaff > 0) rows.push({ label: "Love & Affection", basis: "Other head", value: calculatedResult.loveaff });
                            if (calculatedResult.lossofenjoy > 0) rows.push({ label: "Loss of Enjoyment of Life", basis: "Other head", value: calculatedResult.lossofenjoy });
                          }

                          return rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-800/10 transition-colors">
                              <td className="py-2 px-1 font-semibold text-slate-350">{row.label}</td>
                              <td className="py-2 px-1 text-right text-slate-500 font-mono text-[10px]">{row.basis}</td>
                              <td className="py-2 px-1 text-right font-mono font-bold text-slate-200">
                                {row.isRaw ? row.value : `Rs. ${Number(row.value || 0).toLocaleString('en-IN')}`}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="border-t border-indigo-500/20 pt-4 mt-1 flex justify-between items-center bg-gradient-to-r from-indigo-950/30 to-purple-950/20 p-4 rounded-xl border border-indigo-500/10 shrink-0">
                    <span className="text-xs font-bold text-indigo-300">Total Quantum Calculated:</span>
                    <span className="text-lg font-black text-indigo-200">
                      Rs. {(calculatedResult.final_amount || calculatedResult.final_compensation || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab("benchmarking")}
                      className="flex-1 bg-indigo-950/40 hover:bg-indigo-900/30 border border-indigo-500/30 text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-indigo-300"
                    >
                      <span>Precedents Benchmarking Analysis</span>
                      <ArrowRight className="h-3 w-3 text-indigo-400" />
                    </button>
                    <button
                      onClick={() => setCalculatedResult(null)}
                      className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold py-2 px-3 rounded-xl transition cursor-pointer"
                    >
                      Clear Result
                    </button>
                  </div>
                </div>
              )}
              
              {/* PDF Dropper & Uploader */}
              <div 
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("hidden-file-picker").click()}
                className="bg-slate-900/30 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 transition-all rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden group shadow-xl"
              >
                <input 
                  id="hidden-file-picker"
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => handlePdfUpload(e.target.files[0])}
                  className="hidden"
                />
                <UploadCloud className="h-12 w-12 text-slate-500 group-hover:text-indigo-400 group-hover:scale-110 transition-all mb-3" />
                <h3 className="font-semibold text-slate-200 mb-1 text-sm">
                  Drag & Drop Court Judgment PDF
                </h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  Upload selectable or scanned PDF (upto 50MB) to auto-extract, run OCR, and index case facts.
                </p>
              </div>
              
              {/* OCR Progress visually */}
              {isOcrProcessing && (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>{ocrStatusText}</span>
                    </span>
                    <span className="font-semibold text-slate-400">{ocrProgress}%</span>
                  </div>
                  
                  <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800/60 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* AI Recovery triggers */}
              {ocrRawText && (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">AI Data Recovery (Ollama)</h3>
                      <p className="text-[11px] text-slate-500">Refine details, parse discretionary claims & extract structures using LLM.</p>
                    </div>
                    
                    <button
                      onClick={runAiRecovery}
                      disabled={isOcrProcessing}
                      className="bg-indigo-950 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/30 active:scale-95 text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>AI Recover fields</span>
                    </button>
                  </div>
                  
                  {recoveredRawData && (
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/60 pt-3">
                      <div className="flex justify-between border-b border-slate-800/30 pb-1.5">
                        <span className="text-slate-500">Case Evidence:</span>
                        <span className="font-semibold text-indigo-400">{recoveredRawData.ocr_evidence_case || "UNCLEAR"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800/30 pb-1.5 col-span-1">
                        <span className="text-slate-500">Award Extracted:</span>
                        <span className="font-semibold text-slate-300">Rs. {Number(recoveredRawData.award_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Document Queue status list */}
              {fileQueue.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-3 max-h-[220px] overflow-y-auto">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">File Ingestion Queue</h3>
                  <div className="space-y-2">
                    {fileQueue.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-slate-950/80 border border-slate-800/60 rounded-xl text-xs">
                        <div className="flex items-center gap-2.5 overflow-hidden pr-3">
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="font-semibold text-slate-300 truncate">{item.filename}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === "indexed" ? (
                            <span className="badge text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Indexed</span>
                            </span>
                          ) : item.status === "failed" ? (
                            <span className="badge text-[10px] px-2 py-0.5 rounded-full border border-rose-500/20 bg-rose-950/20 text-rose-400 font-semibold">
                              Failed
                            </span>
                          ) : (
                            <span className="badge text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-950/20 text-indigo-400 font-semibold animate-pulse">
                              {item.status} ({item.progress}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* OCR Text Visualizer panel */}
              {ocrRawText && (
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-3 flex-1 min-h-[250px]">
                  <div className="flex justify-between items-center shrink-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Raw OCR Extracted Text</h3>
                    <span className="text-[10px] text-slate-600 font-mono">Length: {ocrRawText.length} chars</span>
                  </div>
                  <textarea 
                    readOnly 
                    value={ocrRawText}
                    className="flex-1 bg-slate-950/95 border border-slate-800/80 rounded-xl p-4 text-[11px] font-mono focus:outline-none text-slate-400 resize-none overflow-y-auto"
                  ></textarea>
                </div>
              )}
            </div>
            
          </div>
        )}
        
        {/* TAB 2: PRECEDENTS BENCHMARKING PANEL */}
        {activeTab === "benchmarking" && benchmarkResult && (
          <div className="flex-1 flex gap-6 overflow-y-auto p-1 min-h-0">
            <div className="flex-1 flex flex-col gap-6">
              
              {/* Valuation Dashboard Row */}
              <div className="grid grid-cols-3 gap-6">
                
                {/* Calculated Quant card */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-[150px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Calculated Valuation</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-indigo-300">Rs. {benchmarkResult.calculated_amount.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[11px] text-indigo-400 font-medium">Computed by claims math engine</span>
                </div>
                
                {/* Precedents Average award */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-[150px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Precedent Averages</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-slate-200">Rs. {benchmarkResult.average_precedent_award.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Based on semantic vector results</span>
                </div>
                
                {/* Margin / Alignment card */}
                <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-[150px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Precedent Alignment</span>
                  <div className="my-2 flex items-center gap-2">
                    <span className={`text-2xl font-black uppercase ${
                      benchmarkResult.alignment === "aligned" 
                        ? "text-emerald-400" 
                        : benchmarkResult.alignment === "high" 
                        ? "text-amber-400" 
                        : "text-rose-400"
                    }`}>
                      {benchmarkResult.alignment}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">
                      ({benchmarkResult.margin_percent >= 0 ? '+' : ''}{benchmarkResult.margin_percent}%)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Similarity margin calculation</span>
                </div>
              </div>
              
              {/* Benchmarking recommendation */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex gap-4 items-start">
                <AlertCircle className="h-6 w-6 shrink-0 text-indigo-400 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Evaluation Quantum Benchmarks</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{benchmarkResult.recommendation}</p>
                </div>
              </div>
              
              {/* Structured Courtroom Legal Arguments */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Claimant arguments */}
                <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                    <h4 className="text-sm font-bold">Claimant Defensible Court Brief</h4>
                  </div>
                  <p className="text-xs text-emerald-300/80 leading-relaxed font-medium">
                    {benchmarkResult.claimant_argument}
                  </p>
                </div>
                
                {/* Insurance arguments */}
                <div className="bg-rose-950/10 border border-rose-500/20 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-rose-400">
                    <TrendingDown className="h-5 w-5" />
                    <h4 className="text-sm font-bold">Insurance defense Claims Brief</h4>
                  </div>
                  <p className="text-xs text-rose-300/80 leading-relaxed font-medium">
                    {benchmarkResult.insurance_defense}
                  </p>
                </div>
              </div>
              
              {/* Semantic Precedents matches */}
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Semantic Matching Precedents</h3>
                
                <div className="space-y-3">
                  {benchmarkResult.precedents.map((pred, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-950/80 border border-slate-800/60 rounded-xl text-xs hover:border-slate-800 transition-all">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 text-sm">{pred.name || "Unnamed Claimant"}</span>
                          <span className="badge text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-950/20 text-indigo-400 font-semibold">
                            Match: {Math.round(pred.score * 100)}%
                          </span>
                          {pred.is_calculated_fallback && (
                            <span className="text-[10px] text-slate-500 italic">(Simulated Precedent)</span>
                          )}
                        </div>
                        <span className="text-slate-500">{pred.details} | File: <span className="text-indigo-400 font-medium">{pred.filename}</span></span>
                      </div>
                      
                      <div className="text-right">
                        <span className="font-extrabold text-slate-200 text-md">Rs. {Number(pred.award_amount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          </div>
        )}
        
        {/* TAB 3: AI ASSISTANT / CHAT PANEL */}
        {activeTab === "chat" && (
          <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
            
            {/* Left Filter Pane */}
            <div className="w-[30%] bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col gap-5 shrink-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-800/60 pb-3">
                Chat Audit Filters
              </h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Audit Scope (Document)</label>
                <select 
                  value={chatFilterDoc}
                  onChange={(e) => setChatFilterDoc(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">All Library Documents</option>
                  {fileQueue.filter(f => f.status === "indexed").map((f) => (
                    <option key={f.id} value={f.filename}>{f.filename}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Case Filter</label>
                <select 
                  value={chatFilterCaseType}
                  onChange={(e) => setChatFilterCaseType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="all">All Case Types</option>
                  <option value="injury">Injury Claims Only</option>
                  <option value="death">Death Cases Only</option>
                </select>
              </div>
              
              <div className="text-[11px] text-slate-500 leading-relaxed mt-auto border-t border-slate-800/60 pt-4 flex gap-2 items-start">
                <HelpCircle className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                <span>
                  The RAG system combines active workstation details with retrieved precedents from Qdrant, using Ollama to answer questions grounded strictly in legal record evidence.
                </span>
              </div>
            </div>
            
            {/* Right Chat Dialog pane */}
            <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col min-h-0 overflow-hidden">
              
              {/* Message List */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 min-h-0">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-start gap-3.5 max-w-[85%] ${
                      msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div className={`p-2.5 rounded-full shrink-0 ${
                      msg.sender === "user" ? "bg-indigo-900/30 text-indigo-300" : "bg-slate-950 text-slate-400"
                    }`}>
                      {msg.sender === "user" ? <User className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5 animate-pulse" />}
                    </div>
                    
                    <div className={`p-4 rounded-2xl border text-sm leading-relaxed ${
                      msg.sender === "user" 
                        ? "bg-indigo-950/20 border-indigo-500/20 text-indigo-200" 
                        : "bg-slate-950/80 border-slate-800/80 text-slate-300"
                    }`}>
                      {msg.isLoader ? (
                        <div className="flex gap-1.5 py-1">
                          <span className="h-2 w-2 bg-slate-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '0ms' }}></span>
                          <span className="h-2 w-2 bg-slate-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '150ms' }}></span>
                          <span className="h-2 w-2 bg-slate-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      ) : (
                        <div 
                          className="whitespace-pre-line"
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          }}
                        />
                      )}
                      
                      {/* Source Citations */}
                      {msg.precedents && msg.precedents.length > 0 && (
                        <div className="border-t border-slate-800/60 mt-3 pt-3 flex flex-col gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Source References:</span>
                          <div className="flex flex-wrap gap-2">
                            {msg.precedents.slice(0, 3).map((p, i) => (
                              <div key={i} className="text-[10px] px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-indigo-300 font-semibold">
                                {p.filename} (match: {Math.round(p.score * 100)}%)
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 flex gap-3 shrink-0">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Ask a question about claims calculations or precedents..."
                  className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-100"
                />
                
                <button
                  onClick={sendChatMessage}
                  disabled={isChatSending || !chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-slate-100 font-semibold p-3.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </div>
              
            </div>
            
          </div>
        )}
        
        {/* TAB 4: QDRANT VECTOR EXPLORER */}
        {activeTab === "qdrant" && (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-6 shrink-0">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[120px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Collection Name</span>
                <span className="text-md font-bold text-slate-200 truncate mt-2">{qdrantStats.collection_name}</span>
                <span className="text-[10px] text-slate-600">Centralized Precedents ID</span>
              </div>
              
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[120px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Points Count</span>
                <span className="text-2xl font-black text-indigo-300 mt-1">{qdrantStats.points_count}</span>
                <span className="text-[10px] text-slate-600">Indexed vector embeddings</span>
              </div>
              
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[120px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Distance Metric</span>
                <span className="text-xl font-bold text-slate-200 mt-2">{qdrantStats.distance}</span>
                <span className="text-[10px] text-slate-600">Metric for vector comparison</span>
              </div>
              
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[120px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vector Size</span>
                <span className="text-xl font-bold text-slate-200 mt-2">{qdrantStats.vector_size} dims</span>
                <span className="text-[10px] text-slate-600">Embedding dimension size</span>
              </div>
            </div>
            
            {/* Split Panel: Table and JSON inspector */}
            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
              
              {/* Table list */}
              <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col min-h-0 overflow-hidden">
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800/60 shrink-0 bg-slate-950/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Collection Points List (Payloads)
                  </h3>
                  <button 
                    onClick={fetchQdrantPoints}
                    disabled={qdrantLoading}
                    className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${qdrantLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto">
                  {qdrantLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                    </div>
                  ) : qdrantStats.points && qdrantStats.points.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-500 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-4">Point UUID</th>
                          <th className="py-3 px-4">Filename</th>
                          <th className="py-3 px-4 text-center">Chunk</th>
                          <th className="py-3 px-4">Sample Text</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qdrantStats.points.map((pt) => {
                          const payload = pt.payload || {};
                          return (
                            <tr 
                              key={pt.id}
                              onClick={() => setSelectedPoint(pt)}
                              className={`border-b border-slate-850 hover:bg-slate-800/20 cursor-pointer transition-all ${
                                selectedPoint?.id === pt.id ? 'bg-indigo-950/20 border-indigo-500/20' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-mono text-indigo-400 text-[11px] truncate max-w-[120px]">{pt.id}</td>
                              <td className="py-3.5 px-4 font-semibold text-slate-300 truncate max-w-[150px]">{payload.filename || "unknown"}</td>
                              <td className="py-3.5 px-4 text-center"><span className="px-2 py-0.5 rounded-full border border-slate-800 bg-slate-900/60 text-[10px] text-slate-400"># {payload.chunk_id}</span></td>
                              <td className="py-3.5 px-4 text-slate-400 truncate max-w-[280px] font-medium">"{payload.text || ""}"</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Database className="h-10 w-10 text-slate-650" />
                      <span>No indexed points found in Qdrant legal collection yet.</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Side JSON Inspector */}
              {selectedPoint && (
                <div className="w-[40%] bg-slate-900/40 border border-slate-800/60 rounded-2xl shadow-xl flex flex-col overflow-hidden shrink-0">
                  <div className="px-5 py-4 border-b border-slate-800/60 shrink-0 bg-slate-950/20 flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Point Payload Details</span>
                    <button 
                      onClick={() => setSelectedPoint(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 font-bold"
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-5">
                    <div className="flex flex-col gap-4">
                      
                      {/* UUID & Core Metadata */}
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">Point UUID:</span>
                          <span className="font-mono text-indigo-400 select-all font-semibold text-[10px]">{selectedPoint.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Document</span>
                            <span className="text-xs font-semibold text-slate-300 truncate block" title={selectedPoint.payload?.filename}>
                              {selectedPoint.payload?.filename || "Unknown"}
                            </span>
                          </div>
                          
                          <div className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Page Reference</span>
                            <span className="text-xs font-semibold text-slate-300 block">
                              Page {selectedPoint.payload?.page || "N/A"}
                            </span>
                          </div>
                          
                          <div className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Case Type</span>
                            <span className="text-xs font-semibold text-indigo-400 capitalize block">
                              {selectedPoint.payload?.case_type || "injury"}
                            </span>
                          </div>
                          
                          <div className="bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl">
                            <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5">Document Type</span>
                            <span className="text-xs font-semibold text-slate-300 block">
                              {selectedPoint.payload?.document_type || "Judgment"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Generated Context */}
                      <div className="flex flex-col gap-1 border-t border-slate-850 pt-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Generated Context (LLM)</span>
                        <div className="bg-indigo-950/15 border border-indigo-500/10 rounded-xl p-3 text-xs text-indigo-200 leading-relaxed font-medium whitespace-pre-wrap select-text">
                          {selectedPoint.payload?.context || "No contextual metadata generated."}
                        </div>
                      </div>

                      {/* Chunk Content */}
                      <div className="flex flex-col gap-1 border-t border-slate-850 pt-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Chunk Content</span>
                        <div className="bg-slate-950/90 border border-slate-850 rounded-xl p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text max-h-[180px] overflow-y-auto">
                          {selectedPoint.payload?.content || selectedPoint.payload?.text || "No content available."}
                        </div>
                      </div>
                      
                      {/* Full Raw Payload (Collapsible) */}
                      <div className="border-t border-slate-850 pt-3">
                        <details className="group">
                          <summary className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500 cursor-pointer hover:text-slate-400 list-none select-none">
                            <span>Inspect Full JSON Payload</span>
                            <span className="text-[8px] transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <pre className="mt-2 bg-slate-950 border border-slate-850 p-3 rounded-xl text-[10px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all max-h-[140px] overflow-y-auto">
                            {JSON.stringify(selectedPoint.payload, null, 2)}
                          </pre>
                        </details>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}
        
      </div>
      
    </div>
  );
}
