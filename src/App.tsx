import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  CalendarDays,
  UserPlus,
  Clock,
  Phone,
  HeartHandshake,
  Search,
  PlusCircle,
  ChevronRight,
  ClipboardList,
  Upload,
  Filter,
  AlertCircle,
  FileText,
  Trash2,
  Edit,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

// 您剛剛建立的專屬 Google Webhook URL
const GOOGLE_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbwxrf_7APMtfzqUdCvJdE54PgE4vofvRui4AJ9S34o25DpLpdoB_0_uhtnZrqtvvtr48g/exec';

export default function App() {
  // 初始設為空陣列，等待從雲端載入
  const [ministers, setMinisters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('dateAsc');

  // Super Admin 與載入狀態
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & UI States
  const [showMinisterModal, setShowMinisterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [importError, setImportError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    message: '',
    onConfirm: null,
  });

  // 偵測是否為行動裝置
  const isMobileDevice =
    typeof window !== 'undefined' &&
    /Mobi|Android|iPhone/i.test(navigator.userAgent);

  // Forms
  const defaultMinister = {
    id: '',
    name: '',
    gender: '男',
    church: '',
    ministry: '',
    phone: '',
    status: '持續關懷中',
  };
  const [ministerForm, setMinisterForm] = useState(defaultMinister);
  const [importText, setImportText] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const defaultVisit = {
    id: '',
    date: today,
    time: new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    staff: '',
    reaction: '良好',
    otherReaction: '',
    notes: '',
    nextFollowUpDate: '',
  };
  const [visitForm, setVisitForm] = useState(defaultVisit);

  // 監聽 Super Admin 彩蛋
  useEffect(() => {
    if (searchQuery.toLowerCase() === 'superadmin') {
      setIsSuperAdmin(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  // 初始載入資料 (Data Fetching)
  useEffect(() => {
    setIsLoading(true);
    fetch(GOOGLE_WEBHOOK_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMinisters(data);
        } else if (data && Array.isArray(data.data)) {
          setMinisters(data.data);
        }
      })
      .catch((err) => {
        console.error('載入失敗', err);
        // 如果載入失敗（可能是第一次還沒有資料），確保顯示空陣列
        setMinisters([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // --- 真實資料同步整合 (寫入 Google Sheets) ---
  const updateData = async (newData) => {
    setMinisters(newData);
    setIsSyncing(true);
    try {
      // 這裡使用了 no-cors 模式來避免 Google Apps Script 的跨域阻擋問題
      await fetch(GOOGLE_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ data: newData }),
      });
    } catch (error) {
      console.error('同步失敗', error);
      alert('資料同步雲端失敗，請檢查網路連線！');
    } finally {
      setIsSyncing(false);
    }
  };

  const getNextDate = (m) => {
    if (!m.visits || m.visits.length === 0) return null;
    const lastVisit = [...m.visits].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )[0];
    return lastVisit.nextFollowUpDate || null;
  };

  const selectedMinister = useMemo(
    () => ministers.find((m) => m.id === selectedId),
    [ministers, selectedId]
  );

  // 計算數據儀表板 (Dashboard)
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let visitedThisMonth = 0;
    let overdueCount = 0;

    ministers.forEach((m) => {
      const nextDateStr = getNextDate(m);
      if (nextDateStr && nextDateStr < today) overdueCount++;

      if (m.visits) {
        m.visits.forEach((v) => {
          const vDate = new Date(v.date);
          if (
            vDate.getMonth() === currentMonth &&
            vDate.getFullYear() === currentYear
          )
            visitedThisMonth++;
        });
      }
    });
    return { visitedThisMonth, overdueCount };
  }, [ministers, today]);

  // 處理搜尋與排序
  const processedMinisters = useMemo(() => {
    let filtered = ministers.filter(
      (m) =>
        m.name.includes(searchQuery) ||
        m.church.includes(searchQuery) ||
        (m.ministry && m.ministry.includes(searchQuery))
    );

    return filtered.sort((a, b) => {
      if (sortOption === 'church') return a.church.localeCompare(b.church);
      if (sortOption === 'ministry')
        return (a.ministry || '').localeCompare(b.ministry || '');
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

  // --- 個人資料操作 ---
  const handleSaveMinister = (e) => {
    e.preventDefault();
    let updated;
    if (ministerForm.id) {
      updated = ministers.map((m) =>
        m.id === ministerForm.id ? { ...m, ...ministerForm } : m
      );
      updateData(updated);
    } else {
      const newEntry = {
        ...ministerForm,
        id: Date.now().toString(),
        visits: [],
      };
      updated = [...ministers, newEntry];
      updateData(updated);
    }
    setShowMinisterModal(false);
    setMinisterForm(defaultMinister);
  };

  const handleDeleteMinister = (id) => {
    setConfirmDialog({
      show: true,
      message:
        '注意：您正在執行 Super Admin 權限。\n確定要徹底刪除此位對象及其所有探訪紀錄嗎？此操作無法復原。',
      onConfirm: () => {
        const updated = ministers.filter((m) => m.id !== id);
        updateData(updated);
        setSelectedId(null);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
      },
    });
  };

  const openEditMinister = (minister) => {
    setMinisterForm(minister);
    setShowMinisterModal(true);
  };

  // --- 探訪紀錄操作 ---
  const handleSaveVisit = (e) => {
    e.preventDefault();
    const finalReaction =
      visitForm.reaction === '其他'
        ? visitForm.otherReaction
        : visitForm.reaction;

    let updated;
    if (visitForm.id) {
      updated = ministers.map((m) =>
        m.id === selectedId
          ? {
              ...m,
              visits: m.visits.map((v) =>
                v.id === visitForm.id
                  ? { ...visitForm, reaction: finalReaction }
                  : v
              ),
            }
          : m
      );
      updateData(updated);
    } else {
      const visitEntry = {
        ...visitForm,
        id: Date.now().toString(),
        reaction: finalReaction,
      };
      updated = ministers.map((m) =>
        m.id === selectedId ? { ...m, visits: [...m.visits, visitEntry] } : m
      );
      updateData(updated);
    }
    setShowVisitForm(false);
    setVisitForm(defaultVisit);
  };

  const handleDeleteVisit = (visitId) => {
    setConfirmDialog({
      show: true,
      message:
        '注意：您正在執行 Super Admin 權限。\n確定要刪除這筆探訪紀錄嗎？',
      onConfirm: () => {
        const updated = ministers.map((m) =>
          m.id === selectedId
            ? {
                ...m,
                visits: m.visits.filter((v) => v.id !== visitId),
              }
            : m
        );
        updateData(updated);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
      },
    });
  };

  const openEditVisit = (visit) => {
    let reaction = visit.reaction;
    let otherReaction = '';
    if (!['良好', '一般', '冷淡'].includes(reaction)) {
      otherReaction = reaction;
      reaction = '其他';
    }
    setVisitForm({ ...visit, reaction, otherReaction });
    setShowVisitForm(true);
  };

  // --- 批次匯入 ---
  const handleImport = () => {
    try {
      setImportError('');
      const lines = importText.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) throw new Error('沒有偵測到資料');

      const newEntries = lines.map((line) => {
        const parts = line.split(',');
        if (parts.length < 4) throw new Error('欄位不足');
        const [name, church, ministry, phone, gender = '男'] = parts.map((p) =>
          p.trim()
        );
        return {
          id: Math.random().toString(36).substr(2, 9),
          name,
          church,
          ministry,
          phone,
          gender,
          status: '持續關懷中',
          visits: [],
        };
      });

      const updated = [...ministers, ...newEntries];
      updateData(updated);
      setShowImportModal(false);
      setImportText('');
    } catch (e) {
      setImportError(
        '匯入格式錯誤，請確認每行是否為: 姓名,堂會,事工,電話,性別'
      );
    }
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 flex flex-col ${
        showMinisterModal || showImportModal || confirmDialog.show
          ? 'overflow-hidden'
          : ''
      }`}
    >
      <header className="bg-teal-800 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-teal-300" />
            <h1 className="text-xl font-bold flex items-center gap-2">
              宣道堂帶職傳道關懷系統
              {isSuperAdmin && (
                <span className="bg-amber-500 text-xs text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm font-medium tracking-wide">
                  <ShieldAlert size={12} /> SUPREME
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isSyncing && (
              <span className="text-teal-200 text-xs flex items-center gap-1 mr-2 animate-pulse">
                <RefreshCw size={12} className="animate-spin" /> 儲存中...
              </span>
            )}
            <button
              onClick={() => {
                setShowImportModal(true);
                setImportError('');
              }}
              className="p-2 hover:bg-teal-700 rounded-full transition-colors"
              title="批次匯入"
            >
              <Upload size={20} />
            </button>
            <button
              onClick={() => {
                setMinisterForm(defaultMinister);
                setShowMinisterModal(true);
              }}
              className="p-2 hover:bg-teal-700 rounded-full transition-colors"
              title="新增對象"
            >
              <UserPlus size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-24">
        {!selectedId ? (
          <div className="animate-in fade-in duration-300">
            {/* Dashboard */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold mb-1">
                    本月已探訪
                  </div>
                  <div className="text-2xl font-black text-teal-700">
                    {dashboardStats.visitedThisMonth}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      人次
                    </span>
                  </div>
                </div>
                <div className="bg-teal-50 p-3 rounded-full text-teal-600">
                  <ClipboardList size={22} />
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-xs font-bold mb-1">
                    逾期未跟進
                  </div>
                  <div className="text-2xl font-black text-red-600">
                    {dashboardStats.overdueCount}{' '}
                    <span className="text-sm font-normal text-slate-400">
                      人
                    </span>
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-full text-red-500">
                  <AlertCircle size={22} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="relative mb-3">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="搜尋姓名、堂會、或事工..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 scrollbar-hide">
                  <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
                    <Filter size={14} /> 排序方式:
                  </span>
                  <button
                    onClick={() => setSortOption('dateAsc')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                      sortOption === 'dateAsc'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    近到遠
                  </button>
                  <button
                    onClick={() => setSortOption('dateDesc')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                      sortOption === 'dateDesc'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    遠到近
                  </button>
                  <button
                    onClick={() => setSortOption('church')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                      sortOption === 'church'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    依堂會
                  </button>
                  <button
                    onClick={() => setSortOption('ministry')}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                      sortOption === 'ministry'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    依事工
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 relative min-h-[200px]">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mb-3" />
                    <span className="text-sm font-bold text-teal-700 tracking-wider">
                      正在同步雲端資料...
                    </span>
                  </div>
                )}

                {processedMinisters.map((m) => {
                  const nextDate = getNextDate(m);
                  const isoverdue = nextDate && nextDate < today;
                  const isToday = nextDate === today;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`p-4 hover:bg-slate-50 flex items-center justify-between cursor-pointer group border-l-4 transition-all ${
                        isoverdue
                          ? 'border-red-500 bg-red-50/30'
                          : isToday
                          ? 'border-orange-500'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                            isoverdue
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-teal-100 text-teal-700 border-teal-200'
                          }`}
                        >
                          {m.church ? m.church.charAt(0) : '?'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            {m.name}
                            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              已探訪 {m.visits ? m.visits.length : 0} 次
                            </span>
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            {m.church} {m.ministry && `| ${m.ministry}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <div
                          className={`text-sm font-bold px-3 py-1 rounded-md mb-1 flex items-center gap-1 shadow-sm ${
                            !nextDate
                              ? 'text-slate-400 bg-slate-100'
                              : isoverdue
                              ? 'text-white bg-red-500 shadow-sm'
                              : isToday
                              ? 'text-white bg-orange-500 shadow-sm'
                              : 'text-teal-700 bg-teal-100'
                          }`}
                        >
                          {isoverdue && <AlertCircle size={14} />}
                          {!nextDate ? '跟進日: 未設定' : `跟進日: ${nextDate}`}
                        </div>
                        <div className="text-xs text-slate-400 group-hover:text-teal-600 transition-colors flex items-center">
                          點擊查看 <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!isLoading && processedMinisters.length === 0 && (
                  <div className="text-center py-10 text-slate-500">
                    {searchQuery
                      ? '找不到符合條件的名單'
                      : '目前尚無名單，請點擊上方 + 新增或匯入資料'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300 pb-10">
            <button
              onClick={() => setSelectedId(null)}
              className="text-teal-700 font-bold flex items-center gap-1 hover:text-teal-900 transition-colors mb-2"
            >
              <ChevronRight className="rotate-180 w-5 h-5" /> 返回名單總覽
            </button>

            <div className="bg-white rounded-2xl shadow-md border border-teal-100 overflow-hidden relative">
              {isSuperAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button
                    onClick={() => openEditMinister(selectedMinister)}
                    className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                    title="編輯對象"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteMinister(selectedMinister.id)}
                    className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                    title="刪除對象"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <div className="bg-teal-700 p-6 text-white pt-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold mb-1">
                      {selectedMinister.name}
                    </h2>
                    <p className="opacity-90 flex items-center gap-2">
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                        {selectedMinister.gender}
                      </span>
                      <span>
                        已探訪{' '}
                        {selectedMinister.visits
                          ? selectedMinister.visits.length
                          : 0}{' '}
                        次
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg leading-tight">
                      {selectedMinister.church}
                    </div>
                    <div className="text-sm opacity-90 mb-2">
                      {selectedMinister.ministry}
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 font-bold ${
                        !getNextDate(selectedMinister) ||
                        getNextDate(selectedMinister) >= today
                          ? 'bg-white/20 text-white'
                          : 'bg-red-500 text-white shadow-sm'
                      }`}
                    >
                      <CalendarDays size={12} />
                      下次跟進: {getNextDate(selectedMinister) || '未設定'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between md:justify-start gap-4">
                  <span className="text-slate-400">聯絡電話:</span>
                  {isMobileDevice ? (
                    <a
                      href={`tel:${selectedMinister.phone}`}
                      className="text-teal-700 font-bold text-lg flex items-center gap-1 hover:underline decoration-dotted"
                    >
                      <Phone size={16} /> {selectedMinister.phone}
                    </a>
                  ) : (
                    <span
                      className="text-teal-700 font-bold text-lg flex items-center gap-1 select-all"
                      title="請反白複製號碼"
                    >
                      <Phone size={16} /> {selectedMinister.phone}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4">
                  <span className="text-slate-400">目前狀態:</span>
                  <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs rounded-full font-bold">
                    {selectedMinister.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <ClipboardList size={18} /> 探訪紀錄歷程
                </h3>
                {!showVisitForm && (
                  <button
                    onClick={() => {
                      setVisitForm(defaultVisit);
                      setShowVisitForm(true);
                    }}
                    className="text-sm bg-teal-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-1 hover:bg-teal-700 transition-colors"
                  >
                    <PlusCircle size={16} /> 新增登記
                  </button>
                )}
              </div>

              {showVisitForm && (
                <form
                  onSubmit={handleSaveVisit}
                  className="bg-white border-2 border-teal-500 rounded-xl p-6 shadow-xl animate-in zoom-in-95 duration-200"
                >
                  <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-teal-800 text-lg">
                      {visitForm.id ? '編輯探訪紀錄' : '登記本次探訪內容'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowVisitForm(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      取消×
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          邀約同工
                        </label>
                        <input
                          type="text"
                          required
                          value={visitForm.staff}
                          onChange={(e) =>
                            setVisitForm({
                              ...visitForm,
                              staff: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none"
                          placeholder="您的姓名"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          邀約日期
                        </label>
                        <input
                          type="date"
                          required
                          value={visitForm.date}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, date: e.target.value })
                          }
                          className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          時間
                        </label>
                        <input
                          type="time"
                          value={visitForm.time}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, time: e.target.value })
                          }
                          className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          對方反應
                        </label>
                        <select
                          value={visitForm.reaction}
                          onChange={(e) =>
                            setVisitForm({
                              ...visitForm,
                              reaction: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none"
                        >
                          <option value="良好">良好</option>
                          <option value="一般">一般</option>
                          <option value="冷淡">冷淡</option>
                          <option value="其他">其他</option>
                        </select>
                      </div>
                    </div>
                    {visitForm.reaction === '其他' && (
                      <div>
                        <input
                          type="text"
                          placeholder="請註明反應內容..."
                          required
                          value={visitForm.otherReaction}
                          onChange={(e) =>
                            setVisitForm({
                              ...visitForm,
                              otherReaction: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-teal-300 rounded-md bg-teal-50 focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        後續跟進建議
                      </label>
                      <textarea
                        rows="3"
                        required
                        value={visitForm.notes}
                        onChange={(e) =>
                          setVisitForm({ ...visitForm, notes: e.target.value })
                        }
                        className="w-full p-2 border border-slate-300 rounded-md mt-1 focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="紀錄對話重點及下次行動..."
                      ></textarea>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-lg border border-teal-200 mt-2">
                      <label className="text-sm font-bold text-teal-800 flex items-center gap-1 mb-2">
                        <CalendarDays size={16} /> 提醒: 下次預計跟進日期 (必填)
                      </label>
                      <input
                        type="date"
                        required
                        value={visitForm.nextFollowUpDate}
                        onChange={(e) =>
                          setVisitForm({
                            ...visitForm,
                            nextFollowUpDate: e.target.value,
                          })
                        }
                        className="w-full p-3 border-2 border-teal-400 rounded-md font-bold text-teal-900 focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold text-lg shadow-md hover:bg-teal-700 active:scale-95 transition-all mt-4"
                    >
                      {visitForm.id ? '更新紀錄' : '儲存紀錄'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {!selectedMinister.visits ||
                selectedMinister.visits.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />{' '}
                    尚無任何探訪紀錄
                  </div>
                ) : (
                  [...selectedMinister.visits].reverse().map((v) => (
                    <div
                      key={v.id}
                      className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group"
                    >
                      {isSuperAdmin && (
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditVisit(v)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-md transition-colors"
                            title="編輯紀錄"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteVisit(v.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-md transition-colors"
                            title="刪除紀錄"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3 pr-16">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-lg">
                            {v.date}
                          </span>
                          <span className="text-slate-400 text-sm flex items-center gap-1">
                            <Clock size={12} /> {v.time}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                            v.reaction.includes('良好')
                              ? 'bg-green-100 text-green-700'
                              : v.reaction.includes('冷淡')
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          反應: {v.reaction}
                        </span>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs font-bold text-slate-400 mb-1">
                            邀約同工:
                          </div>
                          <div className="text-slate-800 font-medium">
                            {v.staff}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 mb-1">
                            跟進內容與建議:
                          </div>
                          <div className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-md border border-slate-100">
                            {v.notes}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-xs font-bold text-teal-600">
                            當時設定之下次跟進日:
                          </div>
                          <div className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {v.nextFollowUpDate || '未設定'}
                          </div>
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
              <button
                onClick={() => setShowMinisterModal(false)}
                className="hover:text-teal-200 transition-colors"
              >
                X
              </button>
            </div>
            <form onSubmit={handleSaveMinister} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    姓名
                  </label>
                  <input
                    required
                    value={ministerForm.name}
                    onChange={(e) =>
                      setMinisterForm({ ...ministerForm, name: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    性別
                  </label>
                  <select
                    value={ministerForm.gender}
                    onChange={(e) =>
                      setMinisterForm({
                        ...ministerForm,
                        gender: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    所屬堂會
                  </label>
                  <input
                    required
                    value={ministerForm.church}
                    onChange={(e) =>
                      setMinisterForm({
                        ...ministerForm,
                        church: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="例如: 閩南堂"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    所屬事工
                  </label>
                  <input
                    value={ministerForm.ministry}
                    onChange={(e) =>
                      setMinisterForm({
                        ...ministerForm,
                        ministry: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="例如: 詩班"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">
                  聯絡電話
                </label>
                <input
                  required
                  value={ministerForm.phone}
                  onChange={(e) =>
                    setMinisterForm({ ...ministerForm, phone: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              {isSuperAdmin && ministerForm.id && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    狀態 (Super Admin 特權)
                  </label>
                  <input
                    required
                    value={ministerForm.status}
                    onChange={(e) =>
                      setMinisterForm({
                        ...ministerForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 outline-none bg-amber-50"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-teal-600 text-white py-3 mt-2 rounded-lg font-bold shadow-md hover:bg-teal-700 transition-colors"
              >
                {ministerForm.id ? '儲存變更' : '建立檔案'}
              </button>
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
                您可以直接從 Excel 或 Google Sheets 複製資料並貼在下方。
                <br />
                每行代表一位對象，請使用逗號分隔，順序為：
                <br />
                <span className="font-mono font-bold text-teal-700">
                  姓名, 堂會, 事工, 電話, 性別(選填)
                </span>
              </div>
              {importError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1">
                  <AlertCircle size={14} /> {importError}
                </div>
              )}
              <textarea
                rows="8"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full p-3 border rounded-md border-slate-300 text-sm font-mono focus:ring-2 focus:ring-slate-500 outline-none"
                placeholder="周智, 閩南堂, 詩班, 66456823, 男&#10;陳翠華, 總堂, 學生事工, 66620410, 女"
              ></textarea>
              <button
                onClick={handleImport}
                className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors"
              >
                開始匯入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {confirmDialog.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="text-red-500" /> 操作確認
            </h3>
            <p className="text-slate-600 text-sm whitespace-pre-wrap mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmDialog({
                    show: false,
                    message: '',
                    onConfirm: null,
                  })
                }
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold shadow-sm transition-colors"
              >
                確認執行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
