import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, CalendarDays, UserPlus, Clock, Phone,
  HeartHandshake, Search, PlusCircle,
  ChevronRight, ClipboardList, Upload, Filter, AlertCircle, FileText,
  Trash2, Edit, ShieldAlert, RefreshCw, Share2, Table, UserCog, ClipboardEdit
} from 'lucide-react';

const GOOGLE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxrf_7APMtfzqUdCvJdE54PgE4vofvRui4AJ9S34o25DpLpdoB_0_uhtnZrqtvvtr48g/exec';
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1lj2hc3PwI8e6-qbCpaGhkV-cWMVnJ6lESZlrChUS0Zw/edit?usp=sharing';

// 12堂會顏色嚴格綁定
const getChurchColor = (churchName: string) => {
  switch (churchName) {
    case '總堂': return 'bg-purple-100 text-purple-700 border-purple-200';
    case '潮州堂': return 'bg-orange-100 text-orange-700 border-orange-200';
    case '新口岸堂': return 'bg-blue-100 text-blue-700 border-blue-200';
    case '閩南堂': return 'bg-green-100 text-green-700 border-green-200';
    case '下環堂': return 'bg-red-100 text-red-700 border-red-200';
    case '沙梨頭堂': return 'bg-teal-100 text-teal-700 border-teal-200';
    case '筷子基堂': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case '氹仔堂': return 'bg-amber-100 text-amber-800 border-amber-300';
    case '建華堂': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case '新橋堂': return 'bg-orange-50 text-orange-600 border-orange-200';
    case '北區堂': return 'bg-slate-100 text-slate-700 border-slate-200';
    case '祐漢堂': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
    default: return 'bg-slate-50 text-slate-500 border-slate-200';
  }
};

// 堂會代碼映射表 (產生編號用)
const churchCodes: Record<string, string> = {
  '總堂': '01', '潮州堂': '02', '新口岸堂': '03', '閩南堂': '04',
  '氹仔堂': '05', '建華堂': '06', '下環堂': '07', '沙梨頭堂': '08',
  '筷子基堂': '09', '新橋堂': '10', '北區堂': '11', '祐漢堂': '12'
};

export default function App() {
  const [ministers, setMinisters] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('dateAsc');

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [showMinisterModal, setShowMinisterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [importError, setImportError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null as any });

  const [viewMode, setViewMode] = useState<'overview' | 'matching'>('overview');
  const [matchFilter, setMatchFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [assignModal, setAssignModal] = useState({ show: false, ministerId: '', staffName: '' });

  const isMobileDevice = typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);

  const defaultMinister = { id: '', memberNumber: '', name: '', gender: '男', church: '', ministry: '', phone: '', situation: '', status: '持續關懷中', assignedStaff: '' };
  const [ministerForm, setMinisterForm] = useState(defaultMinister);
  const [importText, setImportText] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const defaultVisit = {
    id: '', date: today, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    staff: '', reaction: '良好', otherReaction: '', notes: '', nextFollowUpDate: '', nextFollowUpTime: '10:00'
  };
  const [visitForm, setVisitForm] = useState(defaultVisit);

  useEffect(() => {
    if (searchQuery.toLowerCase() === 'superadmin') {
      setIsSuperAdmin(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  useEffect(() => {
    setIsLoading(true);
    fetch(GOOGLE_WEBHOOK_URL)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMinisters(data);
        } else if (data && Array.isArray(data.data)) {
          setMinisters(data.data);
        }
      })
      .catch(err => {
        console.error("載入失敗", err);
        setMinisters([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateData = async (newData: any[]) => {
    setMinisters(newData);
    setIsSyncing(true);
    try {
      await fetch(GOOGLE_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ data: newData })
      });
    } catch (error) {
      console.error("同步失敗", error);
      alert("資料同步雲端失敗，請檢查網路連線！");
    } finally {
      setIsSyncing(false);
    }
  };

  const getNextMemberNumber = (churchName: string) => {
    const code = churchCodes[churchName] || '99';
    const churchMembers = ministers.filter(m => m.church === churchName && m.memberNumber);
    let maxNum = 0;
    churchMembers.forEach(m => {
      const parts = m.memberNumber.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `${code}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const handleShare = () => {
    const url = window.location.href;
    const fallbackCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('✅ 系統網址已成功複製！您可以直接貼上分享給同工。');
      } catch (err) {
        alert('無法自動複製，請手動複製上方網址分享。');
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        alert('✅ 系統網址已成功複製！您可以直接貼上分享給同工。');
      }).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };

  const getNextDate = (m: any) => {
    if (!m.visits || m.visits.length === 0) return null;
    const lastVisit = [...m.visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return lastVisit.nextFollowUpDate || null;
  };

  const getLatestVisit = (m: any) => {
    if (!m.visits || m.visits.length === 0) return null;
    return [...m.visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const getCalendarLink = (minister: any, visit: any) => {
    if (!visit.nextFollowUpDate) return '#';
    const dateStr = visit.nextFollowUpDate.replace(/-/g, '');
    const timeStr = (visit.nextFollowUpTime || '10:00').replace(':', '') + '00';
    const start = `${dateStr}T${timeStr}`;
    const endHour = String((parseInt(timeStr.substring(0, 2)) + 1) % 24).padStart(2, '0');
    const end = `${dateStr}T${endHour}${timeStr.substring(2)}`;
    const title = encodeURIComponent(`探訪跟進: ${minister.name}`);
    const details = encodeURIComponent(`對象: ${minister.name}\n堂會: ${minister.church}\n電話: ${minister.phone}\n\n上次探訪紀錄:\n${visit.notes}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
  };

  const selectedMinister = useMemo(() => ministers.find(m => m.id === selectedId), [ministers, selectedId]);

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let visitedThisMonth = 0;
    let overdueCount = 0;

    ministers.forEach(m => {
      const nextDateStr = getNextDate(m);
      if (nextDateStr && nextDateStr < today && m.status !== '停止跟進') overdueCount++;
      if (m.visits) {
        m.visits.forEach((v: any) => {
          const vDate = new Date(v.date);
          if (vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear) visitedThisMonth++;
        });
      }
    });
    return { visitedThisMonth, overdueCount };
  }, [ministers, today]);

  const processedMinisters = useMemo(() => {
    let filtered = ministers.filter(m =>
      m.name.includes(searchQuery) ||
      m.church.includes(searchQuery) ||
      (m.ministry && m.ministry.includes(searchQuery)) ||
      (m.memberNumber && m.memberNumber.includes(searchQuery))
    );

    return filtered.sort((a, b) => {
      if (sortOption === 'church') return a.church.localeCompare(b.church);
      if (sortOption === 'ministry') return (a.ministry || '').localeCompare(b.ministry || '');
      const dateA = getNextDate(a) || '9999-12-31';
      const dateB = getNextDate(b) || '9999-12-31';
      if (sortOption === 'dateAsc') return dateA.localeCompare(dateB);
      if (sortOption === 'dateDesc') {
        if (dateA === '9999-12-31') return 1;
        if (dateB === '9999-12-31') return -1;
        return dateB.localeCompare(dateA);
      }
      return 0;
    });
  }, [ministers, searchQuery, sortOption]);

  const handleSaveMinister = (e: any) => {
    e.preventDefault();
    if (ministerForm.id) {
      // 編輯現有資料邏輯
      const original = ministers.find(m => m.id === ministerForm.id);
      if (!original) return;

      const fieldNames: Record<string, string> = {
        name: '姓名', gender: '性別', church: '所屬堂會', ministry: '所屬事工',
        phone: '聯絡電話', situation: '現況', assignedStaff: '跟進同工', status: '狀態'
      };

      let oldValues: string[] = [];
      let newValues: string[] = [];

      Object.keys(fieldNames).forEach(key => {
        if (original[key] !== ministerForm[key]) {
          oldValues.push(original[key] || '(空)');
          newValues.push(ministerForm[key] || '(空)');
        }
      });

      if (oldValues.length > 0) {
        setConfirmDialog({
          show: true,
          message: `您正在將 ${oldValues.join('、')} 修改成 ${newValues.join('、')}，請問是否確認？`,
          onConfirm: () => {
            const updated = ministers.map(m => m.id === ministerForm.id ? { ...m, ...ministerForm } : m);
            updateData(updated);
            setShowMinisterModal(false);
            setMinisterForm(defaultMinister);
            setConfirmDialog({ show: false, message: '', onConfirm: null });
          }
        });
      } else {
        setShowMinisterModal(false);
        setMinisterForm(defaultMinister);
      }
    } else {
      // 新增資料邏輯
      const newMemberNumber = getNextMemberNumber(ministerForm.church);
      const updated = [...ministers, { ...ministerForm, id: Date.now().toString(), memberNumber: newMemberNumber, visits: [] }];
      updateData(updated);
      setShowMinisterModal(false);
      setMinisterForm(defaultMinister);
    }
  };

  const handleDeleteMinister = (id: string) => {
    setConfirmDialog({
      show: true,
      message: '確定要徹底刪除此位對象及其所有探訪紀錄嗎？此操作無法復原。',
      onConfirm: () => {
        updateData(ministers.filter(m => m.id !== id));
        setSelectedId(null);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
      }
    });
  };

  const handleSaveVisit = (e: any) => {
    e.preventDefault();
    const finalReaction = visitForm.reaction === '其他' ? visitForm.otherReaction : visitForm.reaction;
    let updated;
    if (visitForm.id) {
      updated = ministers.map(m => m.id === selectedId ? {
        ...m, visits: m.visits.map((v: any) => v.id === visitForm.id ? { ...visitForm, reaction: finalReaction } : v)
      } : m);
    } else {
      updated = ministers.map(m => m.id === selectedId ? {
        ...m, visits: [...m.visits, { ...visitForm, id: Date.now().toString(), reaction: finalReaction }]
      } : m);
    }
    updateData(updated);
    setShowVisitForm(false);
    setVisitForm(defaultVisit);
  };

  const handleDeleteVisit = (visitId: string) => {
    setConfirmDialog({
      show: true,
      message: '確定要刪除這筆探訪紀錄嗎？',
      onConfirm: () => {
        updateData(ministers.map(m => m.id === selectedId ? {
          ...m, visits: m.visits.filter((v: any) => v.id !== visitId)
        } : m));
        setConfirmDialog({ show: false, message: '', onConfirm: null });
      }
    });
  };

  const handleToggleFollowUp = (id: string, currentStatus: string) => {
    if (currentStatus !== '停止跟進') {
      setConfirmDialog({
        show: true,
        message: '是否確定停止跟進此兄姊？',
        onConfirm: () => {
          const updated = ministers.map(m => m.id === id ? { ...m, status: '停止跟進' } : m);
          updateData(updated);
          setConfirmDialog({ show: false, message: '', onConfirm: null });
        }
      });
    } else {
      const updated = ministers.map(m => m.id === id ? { ...m, status: '持續關懷中' } : m);
      updateData(updated);
    }
  };

  const handleSaveAssign = (e: any) => {
    e.preventDefault();
    const updated = ministers.map(m => 
      m.id === assignModal.ministerId ? { ...m, assignedStaff: assignModal.staffName.trim() } : m
    );
    updateData(updated);
    setAssignModal({ show: false, ministerId: '', staffName: '' });
  };

  const handleImport = () => {
    try {
      setImportError('');
      const lines = importText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) throw new Error('沒有偵測到資料');

      let currentMinisters = [...ministers];
      
      const newEntries = lines.map(line => {
        const parts = line.split(',');
        if (parts.length < 4) throw new Error('欄位不足');
        const [name, church, ministry, phone, gender = '男', situation = ''] = parts.map(p => p.trim());
        
        const code = churchCodes[church] || '99';
        const churchMembers = currentMinisters.filter(m => m.church === church && m.memberNumber);
        let maxNum = 0;
        churchMembers.forEach(m => {
          const mParts = m.memberNumber.split('-');
          if (mParts.length === 2) {
            const num = parseInt(mParts[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
        const newNum = `${code}-${String(maxNum + 1).padStart(3, '0')}`;
        
        const newMember = { 
          id: Math.random().toString(36).substr(2, 9), 
          memberNumber: newNum,
          name, church, ministry, phone, gender, situation, status: '持續關懷中', assignedStaff: '', visits: [] 
        };
        currentMinisters.push(newMember);
        return newMember;
      });

      updateData(currentMinisters);
      setShowImportModal(false);
      setImportText('');
    } catch (e) {
      setImportError("匯入格式錯誤，請確認格式範例。");
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col ${(showMinisterModal || showImportModal || confirmDialog.show) ? 'overflow-hidden' : ''}`}>
      <header className="bg-teal-800 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-teal-300 shrink-0" />
            <h1 className="text-xl font-bold flex flex-wrap items-center gap-1.5 text-white">
              <span>宣道堂帶職傳道</span>
              <span className="flex items-center gap-2">關懷系統
                {isSuperAdmin && (
                  <span className="bg-amber-500 text-xs text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-medium tracking-wide">
                    <ShieldAlert size={12} /> SUPREME
                  </span>
                )}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isSyncing && <span className="text-teal-200 text-xs flex items-center mr-1 animate-pulse"><RefreshCw size={12} className="animate-spin" /></span>}
            <button onClick={() => { setViewMode(viewMode === 'matching' ? 'overview' : 'matching'); setSelectedId(null); }} className={`p-2 rounded-full transition-colors ${viewMode === 'matching' ? 'bg-teal-900 text-teal-300' : 'hover:bg-teal-700 text-white'}`} title="跟進同工配對">
              <UserCog size={20} />
            </button>
            <button onClick={() => window.open(GOOGLE_SHEET_URL, '_blank')} className="p-2 hover:bg-teal-700 rounded-full transition-colors" title="開啟雲端試算表">
              <Table size={20} className="text-white" />
            </button>
            <button onClick={handleShare} className="p-2 hover:bg-teal-700 rounded-full transition-colors" title="分享系統連結">
              <Share2 size={20} className="text-white" />
            </button>
            <button onClick={() => { setShowImportModal(true); setImportError(''); }} className="p-2 hover:bg-teal-700 rounded-full transition-colors" title="批次匯入">
              <Upload size={20} className="text-white" />
            </button>
            <button onClick={() => { setMinisterForm(defaultMinister); setShowMinisterModal(true); }} className="p-2 hover:bg-teal-700 rounded-full transition-colors" title="新增對象">
              <UserPlus size={20} className="text-white" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-24">
        {viewMode === 'matching' ? (
          <div className="animate-in fade-in duration-300">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserCog className="text-teal-600" /> 跟進同工登記配對
              </h2>
              <button onClick={() => setViewMode('overview')} className="text-teal-600 text-sm font-bold flex items-center gap-1 hover:text-teal-800">
                返回總覽 <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text" placeholder="搜尋姓名、堂會、編號尋找配對對象..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 scrollbar-hide">
                  <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0"><Filter size={14} /> 狀態:</span>
                  <button onClick={() => setMatchFilter('all')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${matchFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>全部</button>
                  <button onClick={() => setMatchFilter('unassigned')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${matchFilter === 'unassigned' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>未指派</button>
                  <button onClick={() => setMatchFilter('assigned')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${matchFilter === 'assigned' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>已指派</button>
                </div>
              </div>
            </div>

            <div className="space-y-3 relative min-h-[200px]">
              {isLoading && (
                <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mb-3" />
                  <span className="text-sm font-bold text-teal-700 tracking-wider">正在同步雲端資料...</span>
                </div>
              )}
              {processedMinisters.filter(m => {
                if (matchFilter === 'unassigned') return !m.assignedStaff;
                if (matchFilter === 'assigned') return !!m.assignedStaff;
                return true;
              }).map(m => {
                const isStopped = m.status === '停止跟進';
                return (
                  <div key={m.id} className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${isStopped ? 'opacity-50 grayscale border-slate-200 bg-slate-50' : 'border-slate-100 hover:shadow-md'}`}>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-sm border-2 ${getChurchColor(m.church)}`}>
                        {m.church ? (m.church === '新口岸堂' ? '岸' : m.church.charAt(0)) : '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 text-[16px] flex items-center flex-wrap gap-2">
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">#{m.memberNumber || '00-000'}</span>
                          {m.name}
                          {isStopped && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">停止跟進</span>}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {m.church} {m.ministry && <span className="text-slate-300 mx-1">|</span>} {m.ministry}
                        </div>
                        {m.situation && (
                          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md mt-1.5 truncate max-w-full" title={m.situation}>
                            <span className="font-bold text-slate-400 mr-1">現況:</span>{m.situation}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
                      {m.assignedStaff ? (
                        <button onClick={() => setAssignModal({ show: true, ministerId: m.id, staffName: m.assignedStaff })} className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-teal-100 text-sm font-bold hover:bg-teal-100 transition-colors">
                          <Users size={14} /> {m.assignedStaff} <Edit size={12} className="opacity-50" />
                        </button>
                      ) : (
                        <button onClick={() => setAssignModal({ show: true, ministerId: m.id, staffName: '' })} className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold hover:bg-slate-200 transition-colors shadow-sm border border-slate-200">
                          <PlusCircle size={14} /> 登記配對
                        </button>
                      )}
                      
                      <button onClick={() => { setViewMode('overview'); setSelectedId(m.id); }} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold hover:bg-teal-700 transition-colors shadow-sm">
                        <ClipboardEdit size={14} /> 登記探訪
                      </button>
                    </div>
                  </div>
                );
              })}
              {!isLoading && processedMinisters.length === 0 && (
                <div className="text-center py-10 text-slate-500">找不到符合條件的名單</div>
              )}
            </div>
          </div>
        ) : !selectedId ? (
          <div className="animate-in fade-in duration-300">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold mb-1">本月已探訪</div>
                  <div className="text-2xl font-black text-teal-700">{dashboardStats.visitedThisMonth} <span className="text-sm font-normal text-slate-400">人次</span></div>
                </div>
                <div className="bg-teal-50 p-3 rounded-full text-teal-600"><ClipboardList size={22} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold mb-1">逾期未跟進</div>
                  <div className="text-2xl font-black text-red-600">{dashboardStats.overdueCount} <span className="text-sm font-normal text-slate-400">人</span></div>
                </div>
                <div className="bg-red-50 p-3 rounded-full text-red-500"><AlertCircle size={22} /></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text" placeholder="搜尋姓名、堂會、或事工..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 scrollbar-hide">
                  <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0"><Filter size={14} /> 排序方式:</span>
                  <button onClick={() => setSortOption('dateAsc')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${sortOption === 'dateAsc' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>近到遠</button>
                  <button onClick={() => setSortOption('dateDesc')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${sortOption === 'dateDesc' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>遠到近</button>
                  <button onClick={() => setSortOption('church')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${sortOption === 'church' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>依堂會</button>
                  <button onClick={() => setSortOption('ministry')} className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${sortOption === 'ministry' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>依事工</button>
                </div>
              </div>
            </div>

            <div className="space-y-3 relative min-h-[200px]">
              {isLoading && (
                <div className="absolute inset-0 bg-slate-50/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mb-3" />
                  <span className="text-sm font-bold text-teal-700 tracking-wider">正在同步雲端資料...</span>
                </div>
              )}

              {processedMinisters.map(m => {
                const nextDate = getNextDate(m);
                const isoverdue = nextDate && nextDate < today;
                const isToday = nextDate === today;
                const isStopped = m.status === '停止跟進';

                return (
                  <div key={m.id} onClick={() => setSelectedId(m.id)} className={`p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${isStopped ? 'bg-slate-50 opacity-50 grayscale border border-slate-200 rounded-xl' : 'bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md'} ${isoverdue && !isStopped ? 'border-l-4 border-l-red-500 bg-red-50/30' : isToday && !isStopped ? 'border-l-4 border-l-orange-500' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg border-2 ${isoverdue && !isStopped ? 'bg-red-100 text-red-700 border-red-200' : getChurchColor(m.church)}`}>
                        {m.church ? (m.church === '新口岸堂' ? '岸' : m.church.charAt(0)) : '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">#{m.memberNumber || '00-000'}</span>
                          <span className="font-bold text-slate-800 text-[17px]">{m.name}</span>
                          {isoverdue && !isStopped && <AlertCircle size={14} className="text-red-500" />}
                          {isStopped && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">停止跟進</span>}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          {m.church} {m.ministry && <span className="text-slate-300 mx-1">|</span>} {m.ministry}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">已探訪 {m.visits?.length || 0} 次</span>
                      
                      {m.assignedStaff && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 border border-amber-200 shadow-sm">
                          <Users size={12} /> {m.assignedStaff}
                        </span>
                      )}
                      
                      <div className={`text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 mt-0.5 ${!nextDate ? 'text-slate-400 bg-slate-50' : isoverdue ? 'text-white bg-red-500 shadow-sm' : isToday ? 'text-white bg-orange-500 shadow-sm' : 'text-teal-700 bg-teal-50'}`}>
                        {nextDate ? `跟進: ${nextDate}` : '未設定跟進'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!isLoading && processedMinisters.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  {searchQuery ? '找不到符合條件的名單' : '目前尚無名單，請點擊上方 + 新增或匯入資料'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300 pb-10">
            <div className="flex justify-between items-center mb-2">
              <button onClick={() => setSelectedId(null)} className="text-teal-700 font-bold flex items-center gap-1 hover:text-teal-900 transition-colors">
                <ChevronRight className="rotate-180 w-5 h-5" /> 返回名單總覽
              </button>
              
              <button 
                onClick={() => handleToggleFollowUp(selectedMinister.id, selectedMinister.status)} 
                className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-1 ${selectedMinister.status === '停止跟進' ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}
              >
                {selectedMinister.status === '停止跟進' ? <RefreshCw size={14} /> : <AlertCircle size={14} />}
                {selectedMinister.status === '停止跟進' ? '重新跟進' : '停止跟進'}
              </button>
            </div>

            <div className={`bg-white rounded-2xl shadow-md border border-teal-100 overflow-hidden relative transition-all duration-300 ${selectedMinister.status === '停止跟進' ? 'opacity-60 grayscale' : ''}`}>
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button onClick={() => { setMinisterForm(selectedMinister); setShowMinisterModal(true); }} className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm" title="編輯對象"><Edit size={16} /></button>
                {isSuperAdmin && (
                  <button onClick={() => handleDeleteMinister(selectedMinister.id)} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full transition-colors backdrop-blur-sm" title="刪除對象"><Trash2 size={16} /></button>
                )}
              </div>

              <div className="bg-teal-700 p-6 text-white pt-14">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm bg-teal-900/50 text-teal-100 px-2 py-0.5 rounded border border-teal-600/50 font-mono">#{selectedMinister.memberNumber || '00-000'}</span>
                      <h2 className="text-3xl font-bold text-white truncate">{selectedMinister.name}</h2>
                    </div>
                    <p className="opacity-90 flex items-center justify-start gap-2 mt-2">
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm whitespace-nowrap shrink-0">{selectedMinister.gender}</span>
                      <span className="whitespace-nowrap">已探訪 {selectedMinister.visits ? selectedMinister.visits.length : 0} 次</span>
                      {selectedMinister.assignedStaff && (
                        <span className="bg-amber-500/90 px-2 py-0.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1 shadow-sm">
                          <Users size={12} /> {selectedMinister.assignedStaff} 跟進
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end">
                    <div className="font-bold text-lg leading-tight">{selectedMinister.church}</div>
                    <div className="text-sm opacity-90 mb-3">{selectedMinister.ministry}</div>
                    {(() => {
                      const latestV = getLatestVisit(selectedMinister);
                      if (latestV && latestV.nextFollowUpDate) {
                        return (
                          <a href={getCalendarLink(selectedMinister, latestV)} target="_blank" rel="noopener noreferrer" className={`px-2.5 py-1.5 rounded-md inline-flex flex-col items-end gap-1 hover:opacity-80 transition-opacity shadow-sm ${latestV.nextFollowUpDate >= today ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                            <div className="flex items-center gap-1 text-[11px] opacity-90 font-medium">
                              <CalendarDays size={12} />
                              <span>下次跟進日期:</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-bold">
                              <span>{latestV.nextFollowUpDate} {latestV.nextFollowUpTime || '10:00'}</span>
                              <ChevronRight size={14} className="opacity-70" />
                            </div>
                          </a>
                        );
                      }
                      return (
                        <div className="px-2.5 py-1.5 rounded-md inline-flex flex-col items-end gap-1 bg-white/20 text-white">
                          <div className="flex items-center gap-1 text-[11px] opacity-90 font-medium">
                            <CalendarDays size={12} />
                            <span>下次跟進日期:</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold opacity-80">
                            <span>未設定</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border-t border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 text-xs font-bold">聯絡電話:</span>
                  {isMobileDevice ? (
                    <a href={`tel:${selectedMinister.phone}`} className="text-teal-700 font-bold text-lg flex items-center gap-1 hover:underline decoration-dotted"><Phone size={16} /> {selectedMinister.phone || '未提供'}</a>
                  ) : (
                    <span className="text-teal-700 font-bold text-lg flex items-center gap-1 select-all" title="請反白複製號碼"><Phone size={16} /> {selectedMinister.phone || '未提供'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 md:items-end">
                  <span className="text-slate-400 text-xs font-bold">目前狀態:</span>
                  <span className={`px-3 py-1 text-xs rounded-full font-bold ${selectedMinister.status === '停止跟進' ? 'bg-slate-200 text-slate-500' : 'bg-teal-100 text-teal-800'}`}>
                    {selectedMinister.status || '持續關懷中'}
                  </span>
                </div>
                <div className="md:col-span-2 pt-3 border-t border-slate-200/60 flex flex-col gap-1.5">
                  <span className="text-slate-400 text-xs font-bold">當前現況:</span>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 leading-relaxed shadow-sm">
                    {selectedMinister.situation || <span className="text-slate-400 italic">尚未記錄現況...</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className={`space-y-4 ${selectedMinister.status === '停止跟進' ? 'opacity-60 grayscale transition-all duration-300' : ''}`}>
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><ClipboardList size={18} /> 探訪紀錄歷程</h3>
                {!showVisitForm && (
                  <button onClick={() => { setVisitForm(defaultVisit); setShowVisitForm(true); }} className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-1 hover:bg-teal-700 transition-colors">
                    <PlusCircle size={16} /> 新增登記
                  </button>
                )}
              </div>

              {showVisitForm && (
                <form onSubmit={handleSaveVisit} className="bg-white border-2 border-teal-500 rounded-xl p-6 shadow-xl animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-teal-800 text-lg">{visitForm.id ? '編輯探訪紀錄' : '登記本次探訪內容'}</h4>
                    <button type="button" onClick={() => setShowVisitForm(false)} className="text-slate-400 hover:text-slate-600">取消×</button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">邀約同工</label><input type="text" required value={visitForm.staff} onChange={e => setVisitForm({ ...visitForm, staff: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="您的姓名" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">邀約日期</label><input type="date" required value={visitForm.date} onChange={e => setVisitForm({ ...visitForm, date: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">時間</label><input type="time" value={visitForm.time} onChange={e => setVisitForm({ ...visitForm, time: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">對方反應</label>
                        <select value={visitForm.reaction} onChange={(e) => setVisitForm({ ...visitForm, reaction: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none">
                          <option value="良好">良好</option><option value="一般">一般</option><option value="冷淡">冷淡</option><option value="其他">其他</option>
                        </select>
                      </div>
                    </div>
                    {visitForm.reaction === '其他' && <div><input type="text" placeholder="請註明反應內容..." required value={visitForm.otherReaction} onChange={e => setVisitForm({ ...visitForm, otherReaction: e.target.value })} className="w-full p-2 border border-teal-300 rounded-md bg-teal-50 focus:ring-2 focus:ring-teal-500 outline-none" /></div>}
                    <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">後續跟進建議</label><textarea rows={3} required value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="紀錄對話重點及下次行動..."></textarea></div>
                    
                    <div className="bg-teal-50 p-4 rounded-lg border border-teal-200 mt-2">
                      <label className="text-sm font-bold text-teal-800 flex items-center gap-1 mb-2"><CalendarDays size={16} /> 提醒: 下次預計跟進 (必填)</label>
                      <div className="flex gap-2">
                        <input type="date" required value={visitForm.nextFollowUpDate} onChange={(e) => setVisitForm({ ...visitForm, nextFollowUpDate: e.target.value })} className="w-2/3 p-3 border-2 border-teal-400 rounded-md font-bold text-teal-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                        <input type="time" required value={visitForm.nextFollowUpTime || ''} onChange={(e) => setVisitForm({ ...visitForm, nextFollowUpTime: e.target.value })} className="w-1/3 p-3 border-2 border-teal-400 rounded-md font-bold text-teal-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold text-lg shadow-md hover:bg-teal-700 active:scale-95 transition-all mt-4">{visitForm.id ? '更新紀錄' : '儲存紀錄'}</button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {!selectedMinister.visits || selectedMinister.visits.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-50" /> 尚無任何探訪紀錄</div>
                ) : (
                  [...selectedMinister.visits].reverse().map((v: any) => (
                    <div key={v.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group">
                      {isSuperAdmin && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {
                            let reaction = v.reaction, otherReaction = '';
                            if (!['良好', '一般', '冷淡'].includes(reaction)) { otherReaction = reaction; reaction = '其他'; }
                            setVisitForm({ ...v, reaction, otherReaction }); setShowVisitForm(true);
                          }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-md transition-colors" title="編輯紀錄"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteVisit(v.id)} className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-md transition-colors" title="刪除紀錄"><Trash2 size={14} /></button>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-lg">{v.date}</span>
                          <span className="text-slate-400 text-sm flex items-center gap-1"><Clock size={12} /> {v.time}</span>
                        </div>
                        <div className="flex items-center gap-5 pr-10">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 mb-1">邀請同工</span>
                            <span className="font-bold text-slate-700">{v.staff}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 mb-1">對方反應</span>
                            <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${v.reaction.includes('良好') ? 'bg-green-100 text-green-700' : v.reaction.includes('冷淡') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{v.reaction}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div><div className="text-xs font-bold text-slate-400 mb-1">跟進內容與建議:</div><div className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-md border border-slate-100">{v.notes}</div></div>
                        
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-50 border-dashed">
                          <div className="text-xs font-bold text-slate-500">下次預計跟進日期:</div>
                          {v.nextFollowUpDate ? (
                            <div className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                              {v.nextFollowUpDate} {v.nextFollowUpTime || '10:00'}
                            </div>
                          ) : (
                            <div className="font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">未設定</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 新增/編輯 對象彈窗 */}
      {showMinisterModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-teal-800 text-white font-bold flex justify-between items-center">
              <span>{ministerForm.id ? '編輯對象資料' : '新增關懷對象'}</span>
              <button onClick={() => setShowMinisterModal(false)} className="hover:text-teal-200 transition-colors">X</button>
            </div>
            <form onSubmit={handleSaveMinister} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">姓名</label><input required value={ministerForm.name} onChange={e => setMinisterForm({ ...ministerForm, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">性別</label><select value={ministerForm.gender} onChange={e => setMinisterForm({ ...ministerForm, gender: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"><option value="男">男</option><option value="女">女</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">所屬堂會</label>
                  <select required value={ministerForm.church} onChange={e => setMinisterForm({ ...ministerForm, church: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none">
                    <option value="">請選擇</option>
                    {Object.keys(churchCodes).map(church => <option key={church} value={church}>{church}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">所屬事工</label><input value={ministerForm.ministry} onChange={e => setMinisterForm({ ...ministerForm, ministry: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" placeholder="例如: 學生事工" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">聯絡電話</label><input value={ministerForm.phone} onChange={e => setMinisterForm({ ...ministerForm, phone: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">跟進同工</label><input value={ministerForm.assignedStaff || ''} onChange={e => setMinisterForm({ ...ministerForm, assignedStaff: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" placeholder="可選填" /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">現況</label><textarea value={ministerForm.situation || ''} onChange={e => setMinisterForm({ ...ministerForm, situation: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" placeholder="記錄此對象當前狀況..." rows={2}></textarea></div>
              {isSuperAdmin && ministerForm.id && (
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">狀態 (Super Admin 特權)</label><input required value={ministerForm.status} onChange={e => setMinisterForm({ ...ministerForm, status: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none bg-amber-50" /></div>
              )}
              <button type="submit" className="w-full bg-teal-600 text-white py-3 mt-2 rounded-lg font-bold shadow-md hover:bg-teal-700 transition-colors">{ministerForm.id ? '儲存變更' : '建立檔案'}</button>
            </form>
          </div>
        </div>
      )}

      {/* 批次匯入彈窗 */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-800 text-white font-bold flex justify-between">
              <span>批次載入名單</span>
              <button onClick={() => setShowImportModal(false)}>X</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200 leading-relaxed">
                您可以直接從 Excel 或 Google Sheets 複製資料並貼在下方。<br />
                每行代表一位對象，請使用逗號分隔，順序為：<br />
                <span className="font-mono font-bold text-teal-700">姓名, 堂會, 事工, 電話, 性別(選填), 現況(選填)</span>
              </div>
              {importError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1"><AlertCircle size={14} /> {importError}</div>}
              <textarea rows={6} value={importText} onChange={e => setImportText(e.target.value)} className="w-full p-3 border rounded-md border-slate-300 text-sm font-mono focus:ring-2 focus:ring-slate-500 outline-none" placeholder="陳大文, 總堂, 學生事工, 66123456, 男, 剛畢業&#10;張小玲, 閩南堂, 詩班, 66654321, 女"></textarea>
              <button onClick={handleImport} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors">開始匯入</button>
            </div>
          </div>
        </div>
      )}

      {/* 配對同工設定彈窗 */}
      {assignModal.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <UserCog className="text-teal-600" /> 登記跟進人員
            </h3>
            <form onSubmit={handleSaveAssign}>
              <label className="text-sm font-bold text-slate-500 mb-2 block">
                請輸入跟進同工的中文全名：
              </label>
              <input
                type="text"
                autoFocus
                placeholder="請輸入跟進同工的中文全名"
                className="w-full p-3 border-2 border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none mb-5 font-bold text-teal-900"
                value={assignModal.staffName}
                onChange={e => setAssignModal({ ...assignModal, staffName: e.target.value })}
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setAssignModal({ show: false, ministerId: '', staffName: '' })} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">取消</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-bold shadow-sm transition-colors">儲存配對</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 確認對話框 (層級提升，確保蓋過編輯框) */}
      {confirmDialog.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 p-6 border-2 border-teal-500">
            <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2"><AlertCircle className="text-amber-500" /> 系統提示</h3>
            <p className="text-slate-600 text-[15px] whitespace-pre-wrap mb-6 leading-relaxed bg-amber-50 p-3 rounded-lg border border-amber-100">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">取消</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-bold shadow-sm transition-colors">確認執行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}