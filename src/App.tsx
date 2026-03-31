import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, CalendarDays, UserPlus, Clock, Phone,
  HeartHandshake, Search, PlusCircle,
  ChevronRight, ClipboardList, Upload, Filter, AlertCircle, FileText,
  Trash2, Edit, ShieldAlert, RefreshCw, Share2, Table
} from 'lucide-react';

const GOOGLE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxrf_7APMtfzqUdCvJdE54PgE4vofvRui4AJ9S34o25DpLpdoB_0_uhtnZrqtvvtr48g/exec';

// 新增：請將下方網址換成您真實的 Google Sheet 網址（在瀏覽器上方複製）
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/您的試算表ID/edit';

// 根據堂會名稱自動產生固定的標籤顏色
const getChurchColor = (churchName: string) => {
  const palettes = [
    'bg-teal-100 text-teal-700 border-teal-200',
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-pink-100 text-pink-700 border-pink-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-amber-100 text-amber-700 border-amber-200',
  ];
  if (!churchName) return palettes[0];
  let hash = 0;
  for (let i = 0; i < churchName.length; i++) {
    hash = churchName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
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

  const isMobileDevice = typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);

  const defaultMinister = { id: '', name: '', gender: '男', church: '', ministry: '', phone: '', status: '持續關懷中' };
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

  // 新增：取得最近一次探訪紀錄的完整物件 (為了拿取時間與產生日曆連結)
  const getLatestVisit = (m: any) => {
    if (!m.visits || m.visits.length === 0) return null;
    return [...m.visits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  // 生成 Google 日曆專屬連結
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
      if (nextDateStr && nextDateStr < today) overdueCount++;
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
      (m.ministry && m.ministry.includes(searchQuery))
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
    let updated;
    if (ministerForm.id) {
      updated = ministers.map(m => m.id === ministerForm.id ? { ...m, ...ministerForm } : m);
    } else {
      updated = [...ministers, { ...ministerForm, id: Date.now().toString(), visits: [] }];
    }
    updateData(updated);
    setShowMinisterModal(false);
    setMinisterForm(defaultMinister);
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

  const handleImport = () => {
    try {
      setImportError('');
      const lines = importText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) throw new Error('沒有偵測到資料');

      const newEntries = lines.map(line => {
        const parts = line.split(',');
        if (parts.length < 4) throw new Error('欄位不足');
        const [name, church, ministry, phone, gender = '男'] = parts.map(p => p.trim());
        return { id: Math.random().toString(36).substr(2, 9), name, church, ministry, phone, gender, status: '持續關懷中', visits: [] };
      });

      updateData([...ministers, ...newEntries]);
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
            <HeartHandshake className="w-6 h-6 text-teal-300" />
            {/* 強制標題文字為白色 */}
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
              宣道堂帶職傳道關懷系統
              {isSuperAdmin && (
                <span className="bg-amber-500 text-xs text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-medium tracking-wide">
                  <ShieldAlert size={12} /> SUPREME
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {isSyncing && <span className="text-teal-200 text-xs flex items-center mr-1 animate-pulse"><RefreshCw size={12} className="animate-spin" /></span>}
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
        {!selectedId ? (
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

            {/* 重新設計的現代化卡片列表 */}
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

                return (
                  <div key={m.id} onClick={() => setSelectedId(m.id)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer active:scale-[0.98] hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      {/* 堂會專屬顏色頭像 */}
                      <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-lg border-2 ${getChurchColor(m.church)}`}>
                        {m.church ? m.church.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-slate-800 text-[17px]">{m.name}</span>
                          {isoverdue && <AlertCircle size={14} className="text-red-500" />}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {m.church} {m.ministry && <span className="text-slate-300 mx-1">|</span>} {m.ministry}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">已探訪 {m.visits?.length || 0} 次</span>
                      <div className={`text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${!nextDate ? 'text-slate-400 bg-slate-50' : isoverdue ? 'text-white bg-red-500 shadow-sm' : isToday ? 'text-white bg-orange-500 shadow-sm' : 'text-teal-700 bg-teal-50'}`}>
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
            <button onClick={() => setSelectedId(null)} className="text-teal-700 font-bold flex items-center gap-1 hover:text-teal-900 transition-colors mb-2">
              <ChevronRight className="rotate-180 w-5 h-5" /> 返回名單總覽
            </button>

            <div className="bg-white rounded-2xl shadow-md border border-teal-100 overflow-hidden relative">
              {isSuperAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button onClick={() => { setMinisterForm(selectedMinister); setShowMinisterModal(true); }} className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm" title="編輯對象"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteMinister(selectedMinister.id)} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full transition-colors backdrop-blur-sm" title="刪除對象"><Trash2 size={16} /></button>
                </div>
              )}

              <div className="bg-teal-700 p-6 text-white pt-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold mb-1">{selectedMinister.name}</h2>
                    <p className="opacity-90 flex items-center gap-2">
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{selectedMinister.gender}</span>
                      <span>已探訪 {selectedMinister.visits ? selectedMinister.visits.length : 0} 次</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg leading-tight">{selectedMinister.church}</div>
                    <div className="text-sm opacity-90 mb-2">{selectedMinister.ministry}</div>
                    {(() => {
                      const latestV = getLatestVisit(selectedMinister);
                      if (latestV && latestV.nextFollowUpDate) {
                        return (
                          <a href={getCalendarLink(selectedMinister, latestV)} target="_blank" rel="noopener noreferrer" className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 font-bold hover:opacity-80 transition-opacity shadow-sm ${latestV.nextFollowUpDate >= today ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                            <CalendarDays size={12} />
                            下次跟進: {latestV.nextFollowUpDate} {latestV.nextFollowUpTime || '10:00'}
                            <ChevronRight size={12} className="opacity-70" />
                          </a>
                        );
                      }
                      return (
                        <div className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 font-bold bg-white/20 text-white">
                          <CalendarDays size={12} />
                          下次跟進: 未設定
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between md:justify-start gap-4">
                  <span className="text-slate-400">聯絡電話:</span>
                  {isMobileDevice ? (
                    <a href={`tel:${selectedMinister.phone}`} className="text-teal-700 font-bold text-lg flex items-center gap-1 hover:underline decoration-dotted"><Phone size={16} /> {selectedMinister.phone}</a>
                  ) : (
                    <span className="text-teal-700 font-bold text-lg flex items-center gap-1 select-all" title="請反白複製號碼"><Phone size={16} /> {selectedMinister.phone}</span>
                  )}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4">
                  <span className="text-slate-400">目前狀態:</span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs rounded-full font-bold">
                    {/* 防呆機制：若狀態為空，顯示預設值 */}
                    {selectedMinister.status || '持續關懷中'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
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
                      
                      {/* 同工與反應並排並置中 */}
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
                        
                        {/* 還原為純文字顯示的下次跟進日 */}
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
            <form onSubmit={handleSaveMinister} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">姓名</label><input required value={ministerForm.name} onChange={e => setMinisterForm({ ...ministerForm, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">性別</label><select value={ministerForm.gender} onChange={e => setMinisterForm({ ...ministerForm, gender: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"><option value="男">男</option><option value="女">女</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">所屬堂會</label><input required value={ministerForm.church} onChange={e => setMinisterForm({ ...ministerForm, church: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" placeholder="例如: 總堂" /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">所屬事工</label><input value={ministerForm.ministry} onChange={e => setMinisterForm({ ...ministerForm, ministry: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" placeholder="例如: 學生事工" /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 mb-1 block">聯絡電話</label><input required value={ministerForm.phone} onChange={e => setMinisterForm({ ...ministerForm, phone: e.target.value })} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" /></div>
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
                <span className="font-mono font-bold text-teal-700">姓名, 堂會, 事工, 電話, 性別(選填)</span>
              </div>
              {importError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1"><AlertCircle size={14} /> {importError}</div>}
              <textarea rows={6} value={importText} onChange={e => setImportText(e.target.value)} className="w-full p-3 border rounded-md border-slate-300 text-sm font-mono focus:ring-2 focus:ring-slate-500 outline-none" placeholder="陳大文, 總堂, 學生事工, 66123456, 男&#10;張小玲, 閩南堂, 詩班, 66654321, 女"></textarea>
              <button onClick={handleImport} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors">開始匯入</button>
            </div>
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {confirmDialog.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2"><AlertCircle className="text-red-500" /> 操作確認</h3>
            <p className="text-slate-600 text-sm whitespace-pre-wrap mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">取消</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold shadow-sm transition-colors">確認執行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}