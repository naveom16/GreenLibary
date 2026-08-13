        const configuredApiUrl = (window.NRRU_GREEN_CONFIG && window.NRRU_GREEN_CONFIG.API_URL) || '';
        const configuredApiKey = (window.NRRU_GREEN_CONFIG && window.NRRU_GREEN_CONFIG.API_KEY) || '';
        const configuredProxyUrl = (window.NRRU_GREEN_CONFIG && window.NRRU_GREEN_CONFIG.PROXY_URL) || '';
        const useMockData = typeof window.NRRU_GREEN_CONFIG?.USE_MOCK_DATA === 'boolean'
            ? window.NRRU_GREEN_CONFIG.USE_MOCK_DATA
            : !configuredApiUrl;

        const APP_CONFIG = {
            apiUrl: configuredApiUrl,
            apiKey: configuredApiKey,
            proxyUrl: configuredProxyUrl,
            useMockData
        };

        class NRRUGreenService {
            constructor(config) {
                this.config = config;
            }

            async testConnection() {
                if (!this.config.apiUrl) {
                    return { success: false, message: 'No API URL configured' };
                }

                try {
                    const response = await fetch(this.config.apiUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'text/plain' }
                    });
                    const text = await response.text();
                    return {
                        success: response.ok,
                        status: response.status,
                        text
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: error.message
                    };
                }
            }

            /**
             * [FIXED] เนเธเนเธเธฑเธเธซเธฒ CORS เน€เธกเธทเนเธญเน€เธฃเธตเธขเธ Google Apps Script เธ•เธฃเธ เน เธเธฒเธ GitHub Pages (Static Hosting)
             * เน€เธ”เธดเธกเนเธเน Content-Type: application/json + Header เธเธดเน€เธจเธฉ X-API-Key เธเธถเนเธเธ—เธณเนเธซเนเน€เธเธฃเธฒเธงเนเน€เธเธญเธฃเนเธชเนเธ
             * Preflight Request (OPTIONS) เนเธเธเนเธญเธ เนเธ•เน Apps Script เนเธกเนเธฃเธญเธเธฃเธฑเธ OPTIONS เธเธฃเธดเธ เน เธเธถเธเธ–เธนเธเธเธฅเนเธญเธเธ”เนเธงเธข CORS Error
             * เธงเธดเธเธตเนเธเน: เนเธเน Content-Type: text/plain เนเธฅเธฐเนเธกเนเนเธเธ Header เธเธดเน€เธจเธฉ (เธชเนเธ apiKey เนเธเนเธ body เนเธ—เธ)
             * เธ—เธณเนเธซเนเน€เธเธฃเธฒเธงเนเน€เธเธญเธฃเนเธชเนเธเน€เธเนเธ "Simple Request" เธ—เธตเนเนเธกเนเธ•เนเธญเธ Preflight โ€” เนเธเนเนเธ”เนเธ—เธฑเธเธ—เธตเธเธ GitHub Pages
             *
             * เธเนเธญเธขเธเน€เธงเนเธ: เธ–เนเธฒเธกเธตเธเธฒเธฃเธ•เธฑเนเธเธเนเธฒ PROXY_URL (เน€เธเนเธ deploy เธเธเนเธฎเธชเธ•เนเธ—เธตเนเธฃเธญเธเธฃเธฑเธ PHP เนเธฅเธฐเนเธเน proxy.php)
             * เธเธฐเนเธเน Header เนเธเธเน€เธ”เธดเธก (application/json + X-API-Key) เนเธ”เนเธ•เธฒเธกเธเธเธ•เธด เน€เธเธฃเธฒเธฐ proxy.php
             * เธญเธขเธนเน server เธเธฑเนเธเน€เธ”เธตเธขเธงเธเธฑเธเนเธฅเธฐเธ•เธญเธ CORS/OPTIONS เนเธ”เนเธญเธขเนเธฒเธเธชเธกเธเธนเธฃเธ“เนเธญเธขเธนเนเนเธฅเนเธง
             */
            getHeaders() {
                if (this.config.proxyUrl) {
                    const headers = { 'Content-Type': 'application/json' };
                    if (this.config.apiKey) {
                        headers['X-API-Key'] = this.config.apiKey;
                    }
                    return headers;
                }
                
                return { 'Content-Type': 'text/plain;charset=utf-8' };
            }

            getEndpoint() {
                return this.config.proxyUrl || this.config.apiUrl;
            }

            async request(action, payload = {}) {
                const endpoint = this.getEndpoint();
                if (!endpoint || this.config.useMockData) {
                    return null;
                }

                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: this.getHeaders(),
                        // apiKey เนเธเธเนเธเนเธ body เน€เธชเธกเธญ (เนเธกเนเธเธถเนเธ Header) เน€เธเธทเนเธญเนเธซเนเธ—เธณเธเธฒเธเนเธ”เนเธ—เธฑเนเธเธชเธญเธเนเธซเธกเธ”
                        body: JSON.stringify({ action, payload, apiKey: this.config.apiKey })
                    });

                    const responseText = await response.text();
                    let data = null;
                    try {
                        data = responseText ? JSON.parse(responseText) : null;
                    } catch (parseError) {
                        data = { raw: responseText };
                    }

                    if (!response.ok) {
                        const detail = data?.error || data?.message || responseText || 'API request failed';
                        console.error('API request failed:', { status: response.status, detail });
                        throw new Error(`API request failed (${response.status}): ${detail}`);
                    }

                    return data;
                } catch (error) {
                    console.warn('API unavailable, falling back to mock data:', error);
                    return null;
                }
            }

            async loginUser(payload) {
                return this.request('loginUser', payload);
            }

            async registerUser(payload) {
                return this.request('registerUser', payload);
            }

            async getDashboardData(userEmail) {
                return this.request('getDashboardData', { userEmail });
            }

            async getUserProfile(payload) {
                return this.request('getUserProfile', payload);
            }

            async getCarbonHistory(payload) {
                return this.request('getCarbonHistory', payload);
            }

            async saveCarbonLog(payload) {
                return this.request('saveCarbonLog', payload);
            }

            async updateCarbonLog(payload) {
                return this.request('updateCarbonLog', payload);
            }

            async deleteCarbonLog(payload) {
                return this.request('deleteCarbonLog', payload);
            }

            async getFacultyRanking(payload) {
                return this.request('getFacultyRanking', payload);
            }

            async getPublicDashboardData() {
                return this.request('getPublicDashboardData', {});
            }

            async getUserRank(payload) {
                return this.request('getUserRank', payload);
            }

            async getPublicStats() {
                return this.request('getPublicStats', {});
            }

            async getLevelStats() {
                return this.request('getLevelStats', {});
            }
        }

        const greenService = new NRRUGreenService(APP_CONFIG);

        let currentUser = null;
        let currentUserProfile = null;
        let dashboardData = {
            userProfile: null,
            carbonLogs: [],
            facultyRanking: [],
            rankInfo: null
        };
        let globalRecords = [];
        let userRecords = [];
        let publicStats = null;
        let levelStats = null;

        const emissionFactors = {
            cap: 0.02,
            snack: 0.02,
            milk: 0.15,
            can: 0.20,
            pet: 0.02
        };

        const avgWeightPerItem = {
            cap: 0.005,
            snack: 0.003,
            milk: 0.010,
            can: 0.015,
            pet: 0.015
        };

        const typeNames = {
            cap: 'เธเธฒเธเธงเธ”เธเนเธณ',
            snack: 'เธเธญเธเธเธเธก',
            milk: 'เธเธฅเนเธญเธเธเธก',
            can: 'เธเธฅเนเธญเธเธญเธฅเธนเธกเธดเน€เธเธตเธขเธก',
            pet: 'เธเธงเธ” PET'
        };

        let historyFilters = { search: '', filter: 'all' };
        let currentChartRange = 'day';
        let chartInstance = null;
        let wasteChartInstance = null;

        function getEmissionFactor(typeId) {
            return emissionFactors[typeId] || 0.02;
        }

        function getWasteLabel(typeId) {
            return typeNames[typeId] || 'เนเธกเนเธฃเธฐเธเธธ';
        }

        function calculateCarbonAndGreenPoint(qty, typeId) {
            const carbonSaved = Number((qty * getEmissionFactor(typeId)).toFixed(3));
            let greenPoint = Math.round(carbonSaved * 100);

            if (qty >= 50) {
                greenPoint += 50;
            } else if (qty >= 25) {
                greenPoint += 25;
            } else if (qty >= 10) {
                greenPoint += 10;
            }

            return { carbonSaved, greenPoint };
        }

        function normalizeLogRecord(log, profile) {
            const typeId = String(log.WasteType || log.typeId || '').toLowerCase();
            const normalizedType = typeId in typeNames ? typeId : (typeId === 'aluminum' || typeId === 'aluminium' ? 'can' : 'snack');
            const quantity = Number(log.Quantity || log.qty || 0);
            const carbonSaved = Number(log.CarbonSaved || log.carbon || 0);
            const greenPoint = Number(log.GreenPoint || log.point || 0);
            const dateValue = log.DateTime || log.date || new Date().toISOString();
            const safeProfile = profile || currentUserProfile || {};

            return {
                id: log.LogID || log.id,
                typeId: normalizedType,
                type: getWasteLabel(normalizedType),
                qty: quantity,
                weight: Number((quantity * avgWeightPerItem[normalizedType] || 0).toFixed(3)),
                point: greenPoint,
                carbon: carbonSaved,
                date: formatDisplayDate(dateValue),
                dateTime: dateValue,
                img: log.ImageURL || log.img || '',
                username: safeProfile.Username || safeProfile.name || currentUser?.name || 'เธเธธเธ“',
                userMask: maskUsername(safeProfile.Username || safeProfile.name || currentUser?.name || 'เธเธธเธ“'),
                status: log.Status || 'Pending'
            };
        }

        function formatDisplayDate(dateValue) {
            if (!dateValue) return 'เนเธกเนเธฃเธฐเธเธธ';
            const date = new Date(dateValue);
            if (Number.isNaN(date.getTime())) return dateValue;
            return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
        }

        function maskUsername(name) {
            if (!name || name === 'เธเธธเธ“') return 'เธเธธเธ“';
            const trimmed = name.trim();
            if (trimmed.length <= 2) return trimmed;
            return trimmed.substring(0, 2) + ' ***' + trimmed.substring(trimmed.length - 2);
        }

        function ensureDashboardSections() {
            const privateDashboard = document.getElementById('privateDashboard');
            if (!privateDashboard) return;

            if (!document.getElementById('historyControls')) {
                const historyWrapper = document.querySelector('#personalHistoryTable')?.closest('.overflow-x-auto');
                if (historyWrapper) {
                    historyWrapper.insertAdjacentHTML('beforebegin', `
                        <div id="historyControls" class="mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                            <div class="flex-1">
                                <input id="historySearch" type="text" placeholder="เธเนเธเธซเธฒเธเธฃเธฐเธงเธฑเธ•เธด..." class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500">
                            </div>
                            <div class="min-w-[180px]">
                                <select id="historyFilter" class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500">
                                    <option value="all">เธ—เธธเธเธเธฃเธฐเน€เธ เธ—</option>
                                    <option value="snack">เธเธญเธเธเธเธก</option>
                                    <option value="milk">เธเธฅเนเธญเธเธเธก</option>
                                    <option value="can">เธเธฅเนเธญเธเธญเธฅเธนเธกเธดเน€เธเธตเธขเธก</option>
                                    <option value="cap">เธเธฒเธเธงเธ”เธเนเธณ</option>
                                    <option value="pet">เธเธงเธ” PET</option>
                                </select>
                            </div>
                        </div>
                    `);
                    document.getElementById('historySearch').addEventListener('input', () => {
                        historyFilters.search = document.getElementById('historySearch').value.trim().toLowerCase();
                        updatePersonalDashboard();
                    });
                    document.getElementById('historyFilter').addEventListener('change', () => {
                        historyFilters.filter = document.getElementById('historyFilter').value;
                        updatePersonalDashboard();
                    });
                }
            }

            if (!document.getElementById('dashboardInsights')) {
                const mainGrid = document.querySelector('#privateDashboard > .grid.grid-cols-1.gap-6');
                if (mainGrid) {
                    mainGrid.insertAdjacentHTML('beforebegin', `
                        <div id="dashboardInsights" class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-bold text-slate-800 flex items-center"><i class="fa-solid fa-chart-line text-emerald-500 mr-2"></i> เธเธฃเธฒเธเธฅเธ”เธเธฒเธฃเนเธเธญเธ</h3>
                                    <div class="inline-flex rounded-full bg-slate-100 p-1">
                                        <button onclick="setChartRange('day')" class="px-3 py-1 rounded-full text-sm ${currentChartRange === 'day' ? 'bg-emerald-600 text-white' : 'text-slate-600'}">เธงเธฑเธ</button>
                                        <button onclick="setChartRange('week')" class="px-3 py-1 rounded-full text-sm ${currentChartRange === 'week' ? 'bg-emerald-600 text-white' : 'text-slate-600'}">เธชเธฑเธเธ”เธฒเธซเน</button>
                                        <button onclick="setChartRange('month')" class="px-3 py-1 rounded-full text-sm ${currentChartRange === 'month' ? 'bg-emerald-600 text-white' : 'text-slate-600'}">เน€เธ”เธทเธญเธ</button>
                                    </div>
                                </div>
                                <div class="h-72"><canvas id="carbonChart"></canvas></div>
                            </div>
                            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-lg font-bold text-slate-800 flex items-center"><i class="fa-solid fa-clock-rotate-left text-emerald-500 mr-2 ml-1"></i> เธเธดเธเธเธฃเธฃเธกเธฅเนเธฒเธชเธธเธ”</h3>
                                    <span class="text-xs text-slate-500">10 เธฃเธฒเธขเธเธฒเธฃเธฅเนเธฒเธชเธธเธ”</span>
                                </div>
                                <div id="recentActivities" class="space-y-3 max-h-[320px] overflow-y-auto pr-1"></div>
                            </div>
                        </div>
                    `);
                }
            }

            if (!document.getElementById('editActionBar')) {
                const form = document.getElementById('recordForm');
                if (form) {
                    const editBar = document.createElement('div');
                    editBar.id = 'editActionBar';
                    editBar.className = 'hidden items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700';
                    editBar.innerHTML = `
                        <span><i class="fa-solid fa-pen-to-square mr-2"></i>เธเธณเธฅเธฑเธเนเธเนเนเธเธเธฑเธเธ—เธถเธ</span>
                        <button type="button" onclick="cancelEditRecord()" class="text-xs font-semibold text-amber-700 hover:text-amber-800">เธขเธเน€เธฅเธดเธ</button>
                    `;
                    form.insertBefore(editBar, form.querySelector('button[type="submit"]'));
                    form.insertAdjacentHTML('beforeend', '<input type="hidden" id="editingLogId" value="">');
                }
            }
        }

        function setChartRange(range) {
            currentChartRange = range;
            renderCarbonChart();
        }

        // --- เน€เธฃเธดเนเธกเธ•เนเธเธเธฒเธฃเธ—เธณเธเธฒเธ (Initialization) ---
        window.onload = async function() {
            ensureDashboardSections();
            await initializeApp();
        };

        async function initializeApp() {
            const loadingEl = document.getElementById('publicDashboardLoading');
            const restored = await restoreSession();
            if (!restored) {
                if (loadingEl) loadingEl.classList.remove('hidden');
                await loadPublicDashboardData();
                if (loadingEl) loadingEl.classList.add('hidden');
                updateGlobalStats();
                updatePersonalDashboard();
                renderCarbonChart();
                renderRankings();
            }
        }

        // --- เธฃเธฐเธเธ Authentication UI ---
        function showLoginModal() {
            const modal = document.getElementById('authModal');
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                document.getElementById('authModalContent').classList.remove('scale-95');
            }, 10);
            attachFloatingEffect(modal, document.getElementById('authModalContent'));
        }

        function closeLoginModal() {
            const modal = document.getElementById('authModal');
            modal.classList.add('opacity-0');
            document.getElementById('authModalContent').classList.add('scale-95');
            detachFloatingEffect(modal);
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }

        function toggleRecordModal() {
            const modal = document.getElementById('recordModal');
            const fab = document.getElementById('recordFab');
            if (modal.classList.contains('hidden')) {
                if (fab) fab.classList.add('hidden');
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    modal.querySelector('.bg-white').classList.remove('scale-95');
                }, 10);
                attachFloatingEffect(modal, modal.querySelector('.bg-white'));
            } else {
                modal.classList.add('opacity-0');
                modal.querySelector('.bg-white').classList.add('scale-95');
                detachFloatingEffect(modal);
                setTimeout(() => {
                    modal.classList.add('hidden');
                    if (fab) fab.classList.remove('hidden');
                }, 300);
            }
        }

        function attachFloatingEffect(modal, card) {
            const onMove = (e) => {
                const rect = modal.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const moveX = ((x - centerX) / centerX) * 8;
                const moveY = ((y - centerY) / centerY) * 8;
                card.style.transform = `translate(${moveX}px, ${moveY}px)`;
            };
            const onLeave = () => {
                card.style.transform = 'translate(0px, 0px)';
            };
            modal._floatingHandler = onMove;
            modal._floatingLeave = onLeave;
            modal.addEventListener('mousemove', onMove);
            modal.addEventListener('mouseleave', onLeave);
        }

        function detachFloatingEffect(modal) {
            if (!modal) return;
            if (modal._floatingHandler) {
                modal.removeEventListener('mousemove', modal._floatingHandler);
                modal.removeEventListener('mouseleave', modal._floatingLeave);
                modal._floatingHandler = null;
                modal._floatingLeave = null;
            }
            const card = modal.querySelector('.bg-white');
            if (card) card.style.transform = '';
        }

        function switchTab(tab) {
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            const tabLogin = document.getElementById('tabLogin');
            const tabRegister = document.getElementById('tabRegister');

            if (tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                
                tabLogin.classList.replace('text-slate-400', 'text-emerald-600');
                tabLogin.classList.replace('border-transparent', 'border-emerald-500');
                tabLogin.classList.replace('font-medium', 'font-bold');
                
                tabRegister.classList.replace('text-emerald-600', 'text-slate-400');
                tabRegister.classList.replace('border-emerald-500', 'border-transparent');
                tabRegister.classList.replace('font-bold', 'font-medium');
            } else {
                registerForm.classList.remove('hidden');
                loginForm.classList.add('hidden');
                
                tabRegister.classList.replace('text-slate-400', 'text-emerald-600');
                tabRegister.classList.replace('border-transparent', 'border-emerald-500');
                tabRegister.classList.replace('font-medium', 'font-bold');
                
                tabLogin.classList.replace('text-emerald-600', 'text-slate-400');
                tabLogin.classList.replace('border-emerald-500', 'border-transparent');
                tabLogin.classList.replace('font-bold', 'font-medium');
            }
        }

        function togglePassword(inputId, btn) {
            const input = document.getElementById(inputId);
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        }

        function showMessage(title, subtitle, type = 'success') {
            const isError = type === 'error';
            const iconContainerClass = isError
                ? 'h-10 w-10 bg-red-500/20 rounded-full flex items-center justify-center mr-4 text-red-400'
                : 'h-10 w-10 bg-emerald-500/20 rounded-full flex items-center justify-center mr-4 text-emerald-400';
            const iconClass = isError ? 'fa-solid fa-xmark text-xl' : 'fa-solid fa-check text-xl';
            
            const msgBox = document.createElement('div');
            msgBox.className = 'fixed top-10 left-[40%] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[150] animate-fade-in flex items-center border border-slate-700 opacity-0 transition-opacity duration-500';
            msgBox.innerHTML = `
                <div class="${iconContainerClass}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="text-center">
                    <h4 class="font-bold text-sm">${title}</h4>
                    <p class="text-xs text-slate-300">${subtitle}</p>
                </div>
            `;
            document.body.appendChild(msgBox);
            setTimeout(() => {
                msgBox.classList.remove('opacity-0');
            }, 10);
            setTimeout(() => {
                msgBox.classList.add('opacity-0');
                setTimeout(() => msgBox.remove(), 500);
            }, 3000);
        }

        async function login(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> เธเธณเธฅเธฑเธเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ...';
            }
            
            if (email === 'admin@nrru.ac.th' && password === '123456') {
                currentUser = {
                    name: 'Admin',
                    email: email,
                    isAdmin: true
                };
                currentUserProfile = {
                    Username: 'Admin',
                    Faculty: 'Administration',
                    TotalGreenPoint: 9999,
                    TotalCarbonSaved: 9999,
                    JoinDate: new Date().toISOString(),
                    LastActive: new Date().toISOString()
                };
                await completeAuth('Admin', currentUserProfile);
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ';
                }
                return;
            }
            
            const result = await greenService.loginUser({ email, password });

            if (!result?.success) {
                showMessage('เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธกเนเธชเธณเน€เธฃเนเธ', result?.error || 'เธญเธตเน€เธกเธฅเธซเธฃเธทเธญเธฃเธซเธฑเธชเธเนเธฒเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ', 'error');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ';
                }
                return;
            }

            const profile = result.userProfile || {};
            currentUser = {
                name: profile.Username || email.split('@')[0],
                email: email
            };
            currentUserProfile = profile;
            await completeAuth(profile.Username || currentUser.name, profile);
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ';
            }
        }

        async function register(e) {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const studentId = document.getElementById('regId').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const faculty = document.getElementById('regFaculty').value.trim();
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> เธเธณเธฅเธฑเธเธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ...';
            }

            const result = await greenService.registerUser({
                name,
                email,
                password,
                studentId,
                phone,
                faculty
            });

            if (!result?.success) {
                    showMessage('เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธเนเธกเนเธชเธณเน€เธฃเนเธ', result?.error || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเธฃเนเธฒเธเธเธฑเธเธเธตเนเธ”เน', 'error');
                if (registerBtn) {
                    registerBtn.disabled = false;
                    registerBtn.innerHTML = 'เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ';
                }
                return;
            }

            const profile = result.userProfile || {};
            currentUser = {
                name: profile.Username || name,
                email: email
            };
            currentUserProfile = profile;
            await completeAuth(profile.Username || currentUser.name, profile);
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'เธชเธกเธฑเธเธฃเธชเธกเธฒเธเธดเธ';
            }
        }
        
        async function completeAuth(displayName, profile = null, options = {}) {
            const { silent = false, persist = true } = options;

            closeLoginModal();
            document.getElementById('nav-guest').classList.add('hidden');
            document.getElementById('nav-logged-in').classList.remove('hidden');
            document.getElementById('nav-logged-in').classList.add('flex');
            
            document.getElementById('nav-username').textContent = displayName;
            
            const adminBadge = document.getElementById('admin-badge');
            if (currentUser?.isAdmin && adminBadge) {
                adminBadge.classList.remove('hidden');
            } else if (adminBadge) {
                adminBadge.classList.add('hidden');
            }
            
            // [FIX] เน€เธเธฅเธตเนเธขเธเธเธฒเธ Public Dashboard เน€เธเนเธ Personal Dashboard เธ—เธฑเธเธ—เธต เนเธฅเธฐเธเนเธญเธเธเนเธญเธกเธนเธฅเธฃเธงเธกเธเธญเธเธ—เธฑเนเธเธฃเธฐเธเธ
            document.getElementById('publicDashboard').classList.add('hidden');
            document.getElementById('privateDashboard').classList.remove('hidden');

            if (!silent) {
                setTimeout(() => {
                    document.getElementById('privateDashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            }

            if (persist) {
                saveSession();
            }

            await loadDashboardData();
            updatePersonalDashboard();
            updateGlobalStats();
            renderCarbonChart();
            renderRankings();

            if (!silent) {
                showMessage('เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ', `เธเธธเธ“ ${displayName} เน€เธฃเธดเนเธกเธชเธฐเธชเธกเนเธ•เนเธกเนเธฅเธเธชเธตเน€เธเธตเธขเธงเนเธ”เนเน€เธฅเธข!`);
            }
        }

        function logout() {
            currentUser = null;
            currentUserProfile = null;
            dashboardData = { userProfile: null, carbonLogs: [], facultyRanking: [], rankInfo: null };
            userRecords = [];

            clearSession();

            document.getElementById('nav-guest').classList.remove('hidden');
            document.getElementById('nav-logged-in').classList.add('hidden');
            document.getElementById('nav-logged-in').classList.remove('flex');
            document.getElementById('privateDashboard').classList.add('hidden');
            // [FIX] เธเธฅเธฑเธเธชเธนเน Public Dashboard เน€เธเธเธฒเธฐเธ•เธญเธ Logout เน€เธ—เนเธฒเธเธฑเนเธ
            document.getElementById('publicDashboard').classList.remove('hidden');
            
            const adminBadge = document.getElementById('admin-badge');
            if (adminBadge) adminBadge.classList.add('hidden');
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            loadPublicDashboardData();
            updatePersonalDashboard();
            updateGlobalStats();
            showMessage('เธญเธญเธเธเธฒเธเธฃเธฐเธเธเน€เธฃเธตเธขเธเธฃเนเธญเธข', 'เนเธฅเนเธงเธเธเธเธฑเธเนเธซเธกเน Carbon Hero!');
        }

        // === Login Persistence (Session เธเนเธฒเธ localStorage) ===
        const SESSION_STORAGE_KEY = 'nrru_green_session';

        function saveSession() {
            try {
                const sessionPayload = {
                    email: currentUser?.email || '',
                    name: currentUser?.name || '',
                    isAdmin: !!currentUser?.isAdmin,
                    savedAt: Date.now()
                };
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
            } catch (err) {
                console.warn('เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธ Session เนเธ”เน:', err);
            }
        }

        function clearSession() {
            try {
                localStorage.removeItem(SESSION_STORAGE_KEY);
            } catch (err) {
                console.warn('เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธฅเนเธฒเธ Session เนเธ”เน:', err);
            }
        }

        function loadSession() {
            try {
                const raw = localStorage.getItem(SESSION_STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (err) {
                return null;
            }
        }

        // เน€เธกเธทเนเธญ Refresh เธซเธเนเธฒเน€เธงเนเธ เธซเธฒเธเธเธ Session เธ—เธตเนเธขเธฑเธเนเธกเน Logout เนเธซเนเธเธฅเธฑเธเธชเธนเน Personal Dashboard เธ—เธฑเธเธ—เธต
        async function restoreSession() {
            const session = loadSession();
            if (!session || !session.email) return false;

            if (session.isAdmin) {
                currentUser = { name: session.name || 'Admin', email: session.email, isAdmin: true };
                currentUserProfile = {
                    Username: 'Admin',
                    Faculty: 'Administration',
                    TotalGreenPoint: 9999,
                    TotalCarbonSaved: 9999,
                    JoinDate: new Date().toISOString(),
                    LastActive: new Date().toISOString()
                };
                await completeAuth('Admin', currentUserProfile, { silent: true, persist: false });
                return true;
            }

            currentUser = { name: session.name || session.email.split('@')[0], email: session.email };
            await completeAuth(currentUser.name, null, { silent: true, persist: false });
            return true;
        }

        // --- เธเธฑเธ”เธเธฒเธฃเธฃเธนเธเธ เธฒเธ ---
        function handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    document.getElementById('imageDataString').value = dataUrl;
                    document.getElementById('imagePreview').src = dataUrl;
                    document.getElementById('uploadPlaceholder').classList.add('hidden');
                    document.getElementById('imagePreviewContainer').classList.remove('hidden');
                    document.getElementById('imagePreviewContainer').classList.add('flex');
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        }

        function removeImage() {
            document.getElementById('evidenceImage').value = '';
            document.getElementById('imageDataString').value = '';
            document.getElementById('imagePreview').src = '';
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
            document.getElementById('imagePreviewContainer').classList.add('hidden');
            document.getElementById('imagePreviewContainer').classList.remove('flex');
        }

        // --- เธฃเธฐเธเธเธเธณเธเธงเธ“เนเธฅเธฐเธเธฃเธฐเธกเธงเธฅเธเธฅ ---
        function calculateWeight() {
            const type = document.getElementById('wasteType').value;
            const qtyStr = document.getElementById('wasteQty').value;
            
            if(!type || !qtyStr) {
                document.getElementById('wasteWeight').value = "0.000";
                animateOdometer(document.getElementById('previewPt'), 0, false, 300);
                animateOdometer(document.getElementById('previewCb'), 0, true, 300);
                return;
            }

            const qty = parseInt(qtyStr);
            if(qty <= 0) {
                document.getElementById('wasteWeight').value = "0.000";
                animateOdometer(document.getElementById('previewPt'), 0, false, 300);
                animateOdometer(document.getElementById('previewCb'), 0, true, 300);
                return;
            }

            const estWeight = qty * avgWeightPerItem[type];
            document.getElementById('wasteWeight').value = estWeight.toFixed(3);

            calculatePreview();
        }

        function calculatePreview() {
            const type = document.getElementById('wasteType').value;
            const qtyStr = document.getElementById('wasteQty').value;
            const weightStr = document.getElementById('wasteWeight').value;

            if(!type || !qtyStr || !weightStr) return;

            const qty = parseInt(qtyStr);
            const weight = parseFloat(weightStr);
            const { carbonSaved, greenPoint } = calculateCarbonAndGreenPoint(qty, type);

            animateOdometer(document.getElementById('previewPt'), greenPoint, false);
            animateOdometer(document.getElementById('previewCb'), carbonSaved, true);
            if (weight <= 0) {
                document.getElementById('wasteWeight').value = (qty * avgWeightPerItem[type]).toFixed(3);
            }
        }

        function animateOdometer(element, targetValue, isFloat = false, duration = 500) {
            if (!element) return;
            
            const startValue = parseFloat(element.textContent.replace(/,/g, '')) || 0;
            const endValue = Number(targetValue);
            const diff = endValue - startValue;
            
            if (Math.abs(diff) < 0.001) {
                triggerOdometerAnimation(element);
                return;
            }
            
            const startTime = performance.now();
            
            function easeOutBounce(t) {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) return n1 * t * t;
                else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
                else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
                else return n1 * (t -= 2.625 / d1) * t + 0.984375;
            }
            
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutBounce(progress);
                const currentValue = startValue + diff * easedProgress;
                
                if (isFloat) {
                    element.textContent = currentValue.toFixed(3);
                } else {
                    element.textContent = Math.round(currentValue).toLocaleString();
                }
                
                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    triggerOdometerAnimation(element);
                }
            }
            
            requestAnimationFrame(step);
        }

        function triggerOdometerAnimation(element) {
            if (!element) return;
            element.classList.remove('odometer-spring');
            void element.offsetWidth;
            element.classList.add('odometer-spring');
            setTimeout(() => element.classList.remove('odometer-spring'), 800);
        }

        document.getElementById('wasteWeight').addEventListener('input', calculatePreview);

        async function submitRecord(e) {
            e.preventDefault();
            toggleRecordModal();
            
            const typeId = document.getElementById('wasteType').value;
            const qty = parseInt(document.getElementById('wasteQty').value);
            const weight = parseFloat(document.getElementById('wasteWeight').value);
            const imgData = document.getElementById('imageDataString').value;
            const editingLogId = document.getElementById('editingLogId').value;

            if(!typeId || !qty || !weight) {
                showMessage('เธเนเธญเธกเธนเธฅเนเธกเนเธเธฃเธเธ–เนเธงเธ', 'เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธฃเธฐเน€เธ เธ—เนเธฅเธฐเธเธณเธเธงเธเธเนเธญเธเธเธฑเธเธ—เธถเธ', 'error');
                return;
            }

            const { carbonSaved, greenPoint } = calculateCarbonAndGreenPoint(qty, typeId);

            if(editingLogId) {
                const payload = {
                    logId: editingLogId,
                    userEmail: currentUser?.email,
                    wasteType: typeId,
                    quantity: qty,
                    carbonSaved,
                    greenPoint,
                    imageUrl: imgData,
                    status: 'Approved'
                };
                const result = await greenService.updateCarbonLog(payload);
                if (result && result.success) {
                    showMessage('เธญเธฑเธเน€เธ”เธ•เธชเธณเน€เธฃเนเธ', 'เธเธฑเธเธ—เธถเธเธเธฒเธฃเธชเนเธเธเธขเธฐเธ–เธนเธเธญเธฑเธเน€เธ”เธ•เน€เธฃเธตเธขเธเธฃเนเธญเธข');
                } else {
                    const target = userRecords.find(item => String(item.id) === String(editingLogId));
                    if (target) {
                        target.typeId = typeId;
                        target.type = getWasteLabel(typeId);
                        target.qty = qty;
                        target.weight = Number(weight.toFixed(3));
                        target.point = greenPoint;
                        target.carbon = carbonSaved;
                        target.img = imgData;
                        target.date = formatDisplayDate(new Date().toISOString());
                    }
                    showMessage('เธญเธฑเธเน€เธ”เธ•เธชเธณเน€เธฃเนเธ', 'เธเธฑเธเธ—เธถเธเธเธฒเธฃเธชเนเธเธเธขเธฐเธ–เธนเธเธญเธฑเธเน€เธ”เธ•เน€เธฃเธตเธขเธเธฃเนเธญเธข');
                }
            } else {
                const payload = {
                    userEmail: currentUser?.email,
                    wasteType: typeId,
                    quantity: qty,
                    carbonSaved,
                    greenPoint,
                    imageUrl: imgData,
                    status: 'Approved'
                };
                const result = await greenService.saveCarbonLog(payload);
                if (result && result.success) {
                    showMessage('เธเธฑเธเธ—เธถเธเธชเธณเน€เธฃเนเธ!', `เนเธ”เนเธฃเธฑเธ ${greenPoint} Green Pt. เนเธฅเธฐเธเนเธงเธขเธฅเธ”เธเธฒเธฃเนเธเธญเธ ${carbonSaved.toFixed(3)} kgCOโ`);
                } else {
                    const newRecord = {
                        id: Date.now(),
                        userMask: maskUsername(currentUser?.name || 'เธเธธเธ“'),
                        typeId,
                        type: getWasteLabel(typeId),
                        qty,
                        weight: Number(weight.toFixed(3)),
                        point: greenPoint,
                        carbon: carbonSaved,
                        date: 'เน€เธกเธทเนเธญเธชเธฑเธเธเธฃเธนเน',
                        img: imgData,
                        dateTime: new Date().toISOString(),
                        username: currentUser?.name || 'เธเธธเธ“',
                        userMask: maskUsername(currentUser?.name || 'เธเธธเธ“'),
                        status: 'Approved'
                    };
                    userRecords.unshift(newRecord);
                    globalRecords.unshift({ ...newRecord, userMask: 'เธฃเธฒเธขเธเธฒเธฃเธเธญเธเธเธธเธ“ (You)' });
                    showMessage('เธเธฑเธเธ—เธถเธเธชเธณเน€เธฃเนเธ!', `เนเธ”เนเธฃเธฑเธ ${greenPoint} Green Pt. เนเธฅเธฐเธเนเธงเธขเธฅเธ”เธเธฒเธฃเนเธเธญเธ ${carbonSaved.toFixed(3)} kgCOโ`);
                }
            }

            await loadDashboardData();
            updatePersonalDashboard();
            updateGlobalStats();
            renderCarbonChart();
            renderRankings();
            
            e.target.reset();
            removeImage();
            animateOdometer(document.getElementById('previewPt'), 0, false, 300);
            animateOdometer(document.getElementById('previewCb'), 0, true, 300);
            document.getElementById('editingLogId').value = '';
            const editBar = document.getElementById('editActionBar');
            if (editBar) editBar.classList.add('hidden');
        }

        function cancelEditRecord() {
            document.getElementById('editingLogId').value = '';
            document.getElementById('imageDataString').value = '';
            document.getElementById('imagePreview').src = '';
            document.getElementById('uploadPlaceholder').classList.remove('hidden');
            document.getElementById('imagePreviewContainer').classList.add('hidden');
            document.getElementById('imagePreviewContainer').classList.remove('flex');
            document.getElementById('wasteType').value = '';
            document.getElementById('wasteQty').value = '';
            document.getElementById('wasteWeight').value = '';
            animateOdometer(document.getElementById('previewPt'), 0, false, 300);
            animateOdometer(document.getElementById('previewCb'), 0, true, 300);
            const editBar = document.getElementById('editActionBar');
            if (editBar) editBar.classList.add('hidden');
        }

        function startEditRecord(logId) {
            const target = userRecords.find(item => String(item.id) === String(logId));
            if (!target) return;
            document.getElementById('wasteType').value = target.typeId;
            document.getElementById('wasteQty').value = target.qty;
            document.getElementById('wasteWeight').value = target.weight.toFixed(3);
            document.getElementById('editingLogId').value = target.id;
            document.getElementById('imageDataString').value = target.img || '';
            document.getElementById('imagePreview').src = target.img || '';
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            document.getElementById('imagePreviewContainer').classList.remove('hidden');
            document.getElementById('imagePreviewContainer').classList.add('flex');
            calculatePreview();
            const editBar = document.getElementById('editActionBar');
            if (editBar) editBar.classList.remove('hidden');
            toggleRecordModal();
        }

        async function deleteLogRecord(logId) {
            showDeleteModal(() => {
                performDelete(logId);
            });
        }

        async function performDelete(logId) {
            if (currentUser?.isAdmin) {
                userRecords = userRecords.filter(item => String(item.id) !== String(logId));
                globalRecords = globalRecords.filter(item => String(item.id) !== String(logId));
                showMessage('ลบสำเร็จ', 'บันทึกถูกลบเรียบร้อยแล้ว');
            } else {
                const payload = { logId, userEmail: currentUser?.email };
                const result = await greenService.deleteCarbonLog(payload);
                if (result && result.success) {
                    showMessage('ลบสำเร็จ', 'บันทึกถูกลบเรียบร้อยแล้ว');
                } else {
                    userRecords = userRecords.filter(item => String(item.id) !== String(logId));
                    globalRecords = globalRecords.filter(item => String(item.id) !== String(logId));
                    showMessage('ลบสำเร็จ', 'บันทึกถูกลบเรียบร้อยแล้ว');
                }
            }
            
            await loadDashboardData();
            updatePersonalDashboard();
            updateGlobalStats();
            renderCarbonChart();
            renderRankings();
        }

        function updatePersonalDashboard() {
            const tableBody = document.getElementById('personalHistoryTable');
            const emptyState = document.getElementById('emptyHistoryState');
            
            if (!tableBody) return;
            tableBody.innerHTML = '';
            
            let totalPt = 0;
            let totalCb = 0;
            const profileTotalPt = Number(currentUserProfile?.TotalGreenPoint || 0);
            const profileTotalCb = Number(currentUserProfile?.TotalCarbonSaved || 0);
            const sourceRecords = currentUser?.isAdmin ? globalRecords : userRecords;
            const visibleRecords = sourceRecords.filter(record => {
                const searchText = `${record.type || ''} ${record.username || record.userMask || ''}`.toLowerCase();
                const matchesSearch = historyFilters.search ? searchText.includes(historyFilters.search) : true;
                const matchesFilter = historyFilters.filter === 'all' || record.typeId === historyFilters.filter;
                return matchesSearch && matchesFilter;
            });

            if(visibleRecords.length === 0) {
                emptyState.classList.remove('hidden');
                document.getElementById('personalGreenPoints').textContent = profileTotalPt.toLocaleString();
                document.getElementById('personalCarbonPoints').textContent = profileTotalCb.toFixed(3);
                updateLevelBadge(profileTotalPt);
                renderProfileHero();
                renderAchievements();
                renderSocialHub();
                if (currentUser?.isAdmin) {
                    document.getElementById('emptyTitle').textContent = 'เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเนเธเธฃเธฐเธเธ';
                    document.getElementById('emptySubtitle').textContent = 'Admin Panel - เธ”เธน/เธฅเธเธเนเธญเธกเธนเธฅเธ—เธฑเนเธเธซเธกเธ”เนเธ”เนเธ—เธตเนเธเธตเน';
                } else {
                    document.getElementById('emptyTitle').textContent = 'เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธ—เธณเธเธดเธเธเธฃเธฃเธก';
                    document.getElementById('emptySubtitle').textContent = 'เธกเธฒเธฃเนเธงเธกเธฃเธฑเธเธฉเนเนเธฅเธเธ”เนเธงเธขเธเธฒเธฃเธชเนเธเธเธขเธฐเธฃเธตเนเธเน€เธเธดเธฅเธเธฑเธเน€เธ–เธญเธฐ';
                }
                return;
            } else {
                emptyState.classList.add('hidden');
            }

            visibleRecords.forEach(r => {
                totalPt += r.point || 0;
                totalCb += r.carbon || 0;

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors group';
                
                let imgHtml = '<div class="w-8 h-8 rounded bg-slate-100 mx-auto flex items-center justify-center text-slate-300 text-xs"><i class="fa-solid fa-image"></i></div>';
                if(r.img) {
                    imgHtml = `<img src="${r.img}" class="w-8 h-8 object-cover rounded shadow-sm mx-auto border border-slate-200 group-hover:scale-150 group-hover:shadow-md transition-transform transform origin-center z-10 relative">`;
                }

                tr.innerHTML = `
                    <td class="px-3 py-2 text-slate-500 whitespace-nowrap">${r.date}</td>
                    <td class="px-3 py-2 text-center">${imgHtml}</td>
                    <td class="px-3 py-2 font-medium text-slate-700">${r.type}</td>
                    <td class="px-3 py-2 text-center text-slate-600">${r.qty} เธเธดเนเธ <br><span class="text-[10px] text-slate-400">(${(r.weight || 0).toFixed(3)} kg)</span></td>
                    <td class="px-3 py-2 text-right font-bold text-emerald-600">+${r.point || 0}</td>
                    <td class="px-3 py-2 text-right font-bold text-teal-600">+${(r.carbon || 0).toFixed(3)}</td>
                    <td class="px-3 py-2 text-right">
                        <div class="flex justify-end gap-2">
                            <button type="button" onclick="startEditRecord('${r.id}')" class="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-600 hover:bg-amber-100"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="deleteLogRecord('${r.id}')" class="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            document.getElementById('personalGreenPoints').textContent = (profileTotalPt || totalPt).toLocaleString();
            document.getElementById('personalCarbonPoints').textContent = (profileTotalCb || totalCb).toFixed(3);
            
            updateLevelBadge(profileTotalPt || totalPt);
            renderRecentActivities();
            renderProfileHero();
            renderAchievements();
            renderSocialHub();
        }

        // === Hero Level: เนเธซเธฅเนเธเธเนเธญเธกเธนเธฅเธเธฅเธฒเธเธเธธเธ”เน€เธ”เธตเธขเธงเธเธญเธเธ—เธฑเนเธเธฃเธฐเธเธ (เธ•เธฃเธเธเธฑเธ HERO_LEVEL_DEFS เธเธฑเนเธ Backend) ===
        // เนเธเนเธฃเนเธงเธกเธเธฑเธเธ—เธฑเนเธ Badge เธชเนเธงเธเธ•เธฑเธง, เธเธฒเธฃเนเธ” Achievements เนเธฅเธฐเธเธฃเธฒเธ Hero Level Distribution (Public Dashboard)
        // เน€เธเธดเนเธก/เนเธเนเธฃเธฐเธ”เธฑเธเนเธซเธกเนเนเธเธญเธเธฒเธเธ• (เน€เธเนเธเธฃเธญเธเธฃเธฑเธ Faculty/Major/Weekly/Team/Friend) เนเธซเนเนเธเนเธ—เธตเนเธญเธฒเน€เธฃเธขเนเธเธตเนเธเธธเธ”เน€เธ”เธตเธขเธง
        const HERO_LEVEL_DEFS = [
            { key: 'seed', name: 'Green Seed', icon: '๐ฑ', min: 0, max: 99 },
            { key: 'tree', name: 'Green Tree', icon: '๐ฟ', min: 100, max: 499 },
            { key: 'guardian', name: 'Forest Guardian', icon: '๐ณ', min: 500, max: 999 },
            { key: 'hero', name: 'Carbon Hero', icon: '๐', min: 1000, max: 1999 },
            { key: 'legend', name: 'Earth Legend', icon: '๐‘‘', min: 2000, max: Infinity }
        ];

        function getHeroLevelIndex(points) {
            const idx = HERO_LEVEL_DEFS.findIndex(def => points >= def.min && points <= def.max);
            return idx >= 0 ? idx : 0;
        }

        function updateLevelBadge(points) {
            const levelIndex = getHeroLevelIndex(points);
            const level = HERO_LEVEL_DEFS[levelIndex];
            const next = HERO_LEVEL_DEFS[levelIndex + 1] || null;
            const isMaxLevel = !next;
            const levelName = level.name;
            const icon = level.icon;
            const max = level.max;
            let progress = 0;

            if (isMaxLevel) {
                progress = 100;
            } else {
                const range = max - level.min + 1;
                const current = Math.max(points - level.min, 0);
                progress = (current / range) * 100;
            }

            document.getElementById('personalLevelName').textContent = levelName;
            document.getElementById('personalLevelIcon').textContent = icon;
            document.getElementById('levelBgIcon').textContent = icon;

            if (isMaxLevel) {
                document.getElementById('levelProgressText').textContent = `${points.toLocaleString()} Pt`;
                document.getElementById('levelNextText').textContent = 'เธ•เธณเนเธซเธเนเธเธชเธนเธเธชเธธเธ”!';
            } else {
                document.getElementById('levelProgressText').textContent = `${points.toLocaleString()} / ${max.toLocaleString()} Pt`;
                document.getElementById('levelNextText').textContent = `Next: ${next.name}`;
            }

            document.getElementById('levelProgressBar').style.width = `${progress}%`;

            // [NEW] เธเนเธญเธเธงเธฒเธก "เธ•เนเธญเธเธเธฒเธฃเธญเธตเธ X Point" เนเธฅเธฐ XP Counter Animation
            const remaining = isMaxLevel ? 0 : Math.max(max - points, 0);
            const remainingEl = document.getElementById('levelRemainingText');
            if (remainingEl) {
                remainingEl.textContent = isMaxLevel
                    ? '๐ เธเธธเธ“เธญเธขเธนเนเนเธเธฃเธฐเธ”เธฑเธเธชเธนเธเธชเธธเธ”เนเธฅเนเธง!'
                    : `เธ•เนเธญเธเธเธฒเธฃเธญเธตเธ ${remaining.toLocaleString()} Point`;
            }

            const counterEl = document.getElementById('levelPointsCounter');
            if (counterEl) {
                const from = Number(counterEl.dataset.current || 0);
                animateCounter(counterEl, from, points, 800);
                counterEl.dataset.current = points;
            }
        }

        function animateCounter(el, from, to, duration = 800) {
            const start = performance.now();
            const diff = to - from;
            function step(now) {
                const progress = Math.min((now - start) / duration, 1);
                const value = Math.round(from + diff * progress);
                el.textContent = value.toLocaleString();
                if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        // === Achievement System ===
        const achievementDefinitions = [
            { id: 'first_recycle', icon: '๐ฅ', name: 'First Recycle', desc: 'เธชเนเธเธเธขเธฐเธเธฃเธฑเนเธเนเธฃเธ', check: (ctx) => ctx.logCount >= 1 },
            { id: 'carbon_saver', icon: '๐ฅ', name: 'Carbon Saver', desc: 'เธฅเธ”เธเธฒเธฃเนเธเธญเธเน€เธเธดเธ 10 kg', check: (ctx) => ctx.totalCarbon >= 10 },
            { id: 'eco_hero', icon: '๐ฅ', name: 'Eco Hero', desc: 'เธชเธฐเธชเธก 1,000 Green Point', check: (ctx) => ctx.totalPoint >= 1000 },
            { id: 'green_champion', icon: '๐’', name: 'Ultimate Champion', desc: 'เธชเธฐเธชเธก 10,000 Green Point', check: (ctx) => ctx.totalPoint >= 10000 },
            // [Hero Level] เธชเธฃเนเธฒเธเธเธฒเธฃเนเธ” Achievement เธเธญเธเนเธ•เนเธฅเธฐเธฃเธฐเธ”เธฑเธเธเธฒเธ HERO_LEVEL_DEFS เนเธ”เธขเธ•เธฃเธ
            // เน€เธเธดเนเธก/เธฅเธ”เธฃเธฐเธ”เธฑเธเนเธเธญเธเธฒเธเธ•เนเธเนเนเธเน HERO_LEVEL_DEFS เธเธธเธ”เน€เธ”เธตเธขเธง เนเธกเนเธ•เนเธญเธเนเธเนเธ•เธฃเธเธเธตเนเธญเธตเธ
            ...HERO_LEVEL_DEFS.map(level => ({
                id: `level_${level.key}`,
                icon: level.icon,
                name: level.name,
                desc: `เธฃเธฐเธ”เธฑเธ ${level.name}`,
                levelName: level.name,
                check: (ctx) => ctx.totalPoint >= level.min
            }))
        ];

        function renderAchievements() {
            const grid = document.getElementById('achievementGrid');
            if (!grid) return;

            const ctx = {
                logCount: currentUser?.isAdmin ? globalRecords.length : userRecords.length,
                totalCarbon: Number(currentUserProfile?.TotalCarbonSaved || 0),
                totalPoint: Number(currentUserProfile?.TotalGreenPoint || 0)
            };

            // levelStats เธ•เธญเธเธเธตเนเน€เธเนเธ Array [{name, icon, count, percent}, ...] เธเธฒเธ getLevelStats()
            const levelCountByName = {};
            (levelStats || []).forEach(lv => { levelCountByName[lv.name] = lv.count; });

            grid.innerHTML = achievementDefinitions.map(a => {
                const unlocked = a.check(ctx);
                let countText = '';
                if (a.levelName) {
                    const count = levelCountByName[a.levelName];
                    countText = (count > 0) ? `${count} เธเธ` : 'เธขเธฑเธเนเธกเนเธกเธตเธเธนเนเนเธเนเธเธฒเธ';
                }

                return `
                    <div class="rounded-2xl border p-3 text-center transition-all ${unlocked ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}">
                        <div class="text-3xl mb-1 ${unlocked ? '' : 'grayscale opacity-40'}">${a.icon}</div>
                        <p class="text-xs font-bold ${unlocked ? 'text-amber-700' : 'text-slate-400'}">${a.name}</p>
                        <p class="text-[10px] mt-0.5 ${unlocked ? 'text-amber-600/80' : 'text-slate-400'}">${countText || a.desc}</p>
                        ${unlocked
                            ? '<p class="text-[9px] text-emerald-600 font-semibold mt-1"><i class="fa-solid fa-circle-check mr-0.5"></i>เธเธฅเธ”เธฅเนเธญเธเนเธฅเนเธง</p>'
                            : '<p class="text-[9px] text-slate-400 mt-1"><i class="fa-solid fa-lock mr-0.5"></i>เธขเธฑเธเนเธกเนเธเธฅเธ”เธฅเนเธญเธ</p>'}
                    </div>
                `;
            }).join('');
        }

        // === Personal Profile Hero Section ===
        function getInitials(name) {
            if (!name) return 'NR';
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.trim().substring(0, 2).toUpperCase();
        }

        function renderProfileHero() {
            const section = document.getElementById('profileHeroSection');
            if (!section) return;

            const profile = currentUserProfile || {};
            const displayName = profile.Username || currentUser?.name || 'เธเธฑเธเธจเธถเธเธฉเธฒ NRRU';

            document.getElementById('profileAvatarInitials').textContent = getInitials(displayName);
            document.getElementById('profileFullName').textContent = displayName;
            document.getElementById('profileStudentId').textContent = profile.StudentID || 'เนเธกเนเธฃเธฐเธเธธเธฃเธซเธฑเธชเธเธฑเธเธจเธถเธเธฉเธฒ';
            document.getElementById('profileFaculty').textContent = profile.Faculty || 'เนเธกเนเธฃเธฐเธเธธเธเธ“เธฐ';

            const rankInfo = dashboardData.rankInfo || {};
            document.getElementById('profileFacultyRank').textContent = rankInfo.facultyRank ? `#${rankInfo.facultyRank}` : '-';
            document.getElementById('profileFacultyRankTotal').textContent = rankInfo.facultyTotal ? `เธเธฒเธ ${rankInfo.facultyTotal} เธเธ` : '';
        }

        // === [FUTURE] Social Features Scaffold ===
        // เนเธเธฃเธเธชเธฃเนเธฒเธเธเนเธญเธกเธนเธฅเน€เธ•เธฃเธตเธขเธกเนเธงเนเธชเธณเธซเธฃเธฑเธเธ•เนเธญเธขเธญเธ”เนเธเธญเธเธฒเธเธ• (Friend System, Faculty/Major Battle,
        // Team Challenge, Weekly Challenge, Leaderboard) โ€” เธขเธฑเธเนเธกเนเน€เธเธดเธ”เนเธเนเธเธฒเธเนเธเน€เธงเธญเธฃเนเธเธฑเธเธเธตเน
        const socialFeatureFlags = {
            friends: false,
            facultyBattle: false,
            majorBattle: false,
            teamChallenge: false,
            weeklyChallenge: false,
            leaderboard: false
        };

        let socialData = {
            friends: [],          // [{ userId, name, status }]
            teams: [],             // [{ teamId, name, memberIds: [] }]
            challenges: [],        // [{ challengeId, type: 'weekly'|'facultyBattle'|'majorBattle', ... }]
            leaderboardCache: []   // เธเธฅเธฅเธฑเธเธเน Leaderboard เธฅเนเธฒเธชเธธเธ”เธ—เธตเนเธ”เธถเธเธกเธฒ (เน€เธกเธทเนเธญเน€เธเธดเธ”เนเธเนเธเธฒเธเนเธเธญเธเธฒเธเธ•)
        };

        function renderSocialHub() {
            // TODO: เน€เธเธดเธ”เนเธเนเธเธฒเธเน€เธกเธทเนเธญ Backend เธฃเธญเธเธฃเธฑเธ endpoint เธชเธณเธซเธฃเธฑเธ Social Features
            const section = document.getElementById('socialHubSection');
            if (!section) return;
            const anyEnabled = Object.values(socialFeatureFlags).some(Boolean);
            section.classList.toggle('hidden', !anyEnabled);
        }

        function downloadPortfolio() {
            const msgBox = document.createElement('div');
            msgBox.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-8 py-6 rounded-2xl shadow-2xl z-[150] animate-fade-in flex flex-col items-center border border-slate-700 w-80 text-center';
            
            const pt = document.getElementById('personalGreenPoints').textContent;
            const cb = document.getElementById('personalCarbonPoints').textContent;
            const lvl = document.getElementById('personalLevelName').textContent;
            const icon = document.getElementById('personalLevelIcon').textContent;
            
            const userNameEl = document.querySelector('#nav-username');
            const userName = userNameEl ? userNameEl.textContent : 'เธเธฑเธเธจเธถเธเธฉเธฒ NRRU';

            msgBox.innerHTML = `
                <div class="text-5xl mb-3 drop-shadow-lg scale-110">${icon}</div>
                <h4 class="font-bold text-xl mb-1 text-emerald-400 tracking-wide">Certificate of Impact</h4>
                <p class="text-xs mb-4 text-slate-300">NRRU Library Carbon Hero</p>
                
                <div class="bg-slate-800 p-4 rounded-xl w-full text-sm border border-slate-700 mb-4 shadow-inner">
                    <p class="text-slate-400 mb-1 text-[11px]">เธกเธญเธเนเธซเนเน€เธเธทเนเธญเนเธชเธ”เธเธงเนเธฒ</p>
                    <p class="text-lg font-bold text-white mb-3 truncate">${userName}</p>
                    <div class="grid grid-cols-2 gap-2 text-left">
                        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
                            <div class="text-[10px] text-slate-400 mb-0.5">เธฃเธฐเธ”เธฑเธ (Badge)</div>
                            <div class="font-bold text-amber-400">${lvl}</div>
                        </div>
                        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
                            <div class="text-[10px] text-slate-400 mb-0.5">เธฅเธ”เธเธฒเธฃเนเธเธญเธ (COโ)</div>
                            <div class="font-bold text-teal-400">${cb} kg</div>
                        </div>
                    </div>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-1 mb-2">
                    <div class="bg-emerald-500 h-1 rounded-full animate-pulse" style="width: 100%"></div>
                </div>
                <p class="text-[11px] text-emerald-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> เธฃเธฐเธเธเธเธณเธฅเธฑเธเธชเธฃเนเธฒเธเน€เธญเธเธชเธฒเธฃ Portfolio...</p>
            `;
            document.body.appendChild(msgBox);
            
            setTimeout(() => {
                msgBox.classList.add('opacity-0', 'transition-opacity', 'duration-500', 'transform', '-translate-y-4');
                setTimeout(() => msgBox.remove(), 500);
            }, 5000);
        }

        async function loadPublicDashboardData() {
            showLoading();
            
            const [recordsResult, statsResult, levelResult, facultyResult] = await Promise.all([
                greenService.getPublicDashboardData(),
                greenService.getPublicStats(),
                greenService.getLevelStats(),
                greenService.getFacultyRanking()
            ]);

            if (recordsResult && recordsResult.success) {
                globalRecords = (recordsResult.records || []).map(record => ({
                    id: record.id || Date.now() + Math.random(),
                    userMask: record.userMask || 'เนเธกเนเธฃเธฐเธเธธ',
                    type: record.type || getWasteLabel(record.typeId),
                    typeId: record.typeId || 'snack',
                    qty: record.qty || 0,
                    weight: record.weight || 0,
                    point: record.point || 0,
                    carbon: record.carbon || 0,
                    date: record.date || formatDisplayDate(record.dateTime || new Date().toISOString()),
                    dateTime: record.dateTime || new Date().toISOString(),
                    img: record.img || '',
                    username: record.username || '',
                    userMask: record.userMask || 'เนเธกเนเธฃเธฐเธเธธ',
                    status: record.status || 'Approved'
                }));
            } else {
                globalRecords = [];
            }

            if (statsResult && statsResult.success && statsResult.stats) {
                publicStats = statsResult.stats;
                document.getElementById('statParticipants').textContent = publicStats.participants || 0;
                document.getElementById('statItems').textContent = (publicStats.totalItems || 0).toLocaleString();
                document.getElementById('statWeight').textContent = (publicStats.totalWeight || 0).toFixed(2);
                document.getElementById('globalCarbonPoints').textContent = (publicStats.totalCarbon || 0).toFixed(3);
                document.getElementById('globalGreenPoints').textContent = (publicStats.totalPoints || 0).toLocaleString();
            } else {
                publicStats = null;
            }

            if (levelResult && levelResult.success && levelResult.levels) {
                levelStats = levelResult.levels;
                if (!publicStats) {
                    document.getElementById('statParticipants').textContent = levelResult.participants || 0;
                }
                renderLevelDistribution(levelResult.participants || 0, levelStats);
            } else {
                levelStats = null;
                renderLevelDistribution(0, []);
            }

            if (facultyResult && facultyResult.success) {
                dashboardData.facultyRanking = facultyResult.ranking || [];
            } else {
                dashboardData.facultyRanking = [];
            }
            
            hideLoading();
        }

        async function loadDashboardData() {
            if (!currentUser?.email) {
                userRecords = [];
                currentUserProfile = null;
                return;
            }

            showLoading();
            
            const result = await greenService.getDashboardData(currentUser.email);
            if (result && result.success) {
                dashboardData = {
                    userProfile: result.userProfile || result.profile || null,
                    carbonLogs: result.carbonLogs || [],
                    facultyRanking: result.facultyRanking || [],
                    rankInfo: result.rankInfo || null
                };
                currentUserProfile = dashboardData.userProfile;
                userRecords = (dashboardData.carbonLogs || []).map(log => normalizeLogRecord(log, dashboardData.userProfile));
                const fallbackRecords = [...globalRecords.filter(item => item.userMask !== 'เธฃเธฒเธขเธเธฒเธฃเธเธญเธเธเธธเธ“ (You)')];
                globalRecords = [
                    ...userRecords.slice(0, 5).map(record => ({ ...record, userMask: 'เธฃเธฒเธขเธเธฒเธฃเธเธญเธเธเธธเธ“ (You)' })),
                    ...fallbackRecords.slice(0, 5)
                ];
                if (dashboardData.facultyRanking?.length) {
                    globalRecords = [...globalRecords, ...dashboardData.facultyRanking.slice(0, 3).map((item, index) => ({
                        id: 1000 + index,
                        userMask: item.Faculty || item.name || 'Faculty',
                        type: 'Faculty Rank',
                        typeId: 'cap',
                        qty: 0,
                        weight: 0,
                        point: item.TotalGreenPoint || 0,
                        carbon: 0,
                        date: 'Ranking',
                        img: ''
                    }))];
                }
            } else {
                currentUserProfile = {
                    Username: currentUser?.name || 'เธเธธเธ“',
                    Faculty: 'เธเธ“เธฐเธงเธดเธ—เธขเธฒเธจเธฒเธชเธ•เธฃเน',
                    TotalGreenPoint: 0,
                    TotalCarbonSaved: 0,
                    JoinDate: new Date().toISOString(),
                    LastActive: new Date().toISOString(),
                    StudentID: ''
                };
                dashboardData.userProfile = currentUserProfile;
                dashboardData.rankInfo = null;
                userRecords = [];
            }

            const statsResult = await greenService.getPublicStats();
            if (statsResult && statsResult.success && statsResult.stats) {
                publicStats = statsResult.stats;
            } else {
                publicStats = null;
            }

            const levelResult = await greenService.getLevelStats();
            if (levelResult && levelResult.success && levelResult.levels) {
                levelStats = levelResult.levels;
                renderLevelDistribution(levelResult.participants || 0, levelStats);
            } else {
                levelStats = null;
                renderLevelDistribution(0, []);
            }
            
            hideLoading();
        }

        function updateGlobalStats() {
            let totalGlobalPt = 0;
            let totalGlobalCb = 0;
            let totalGlobalQty = 0;
            let totalGlobalWeight = 0;
            
            const feedContainer = document.getElementById('globalActivityFeed');
            if (feedContainer) feedContainer.innerHTML = '';

            const animateValue = (element, start, end, duration = 1000, isFloat = false) => {
                if (!element) return;
                const startTime = performance.now();
                const diff = end - start;
                
                function step(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    const current = start + diff * easeProgress;
                    
                    element.textContent = isFloat ? current.toFixed(3) : Math.round(current).toLocaleString();
                    
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    }
                }
                
                requestAnimationFrame(step);
            };

            if (publicStats) {
                const carbonEl = document.getElementById('globalCarbonPoints');
                const greenEl = document.getElementById('globalGreenPoints');
                const participantsEl = document.getElementById('statParticipants');
                const itemsEl = document.getElementById('statItems');
                const weightEl = document.getElementById('statWeight');

                animateValue(participantsEl, 0, publicStats.participants || 0, 1200, false);
                animateValue(itemsEl, 0, publicStats.totalItems || 0, 1200, false);
                animateValue(weightEl, 0, publicStats.totalWeight || 0, 1200, true);
                animateValue(carbonEl, 0, publicStats.totalCarbon || 0, 1200, true);
                animateValue(greenEl, 0, publicStats.totalPoints || 0, 1200, false);
            } else {
                globalRecords.forEach(r => {
                    totalGlobalPt += r.point || 0;
                    totalGlobalCb += r.carbon || 0;
                    totalGlobalQty += r.qty || 0;
                    totalGlobalWeight += r.weight || 0;
                });

                document.getElementById('statParticipants').textContent = "0";
                document.getElementById('statItems').textContent = totalGlobalQty.toLocaleString();
                document.getElementById('statWeight').textContent = totalGlobalWeight.toFixed(2);
                document.getElementById('globalCarbonPoints').textContent = totalGlobalCb.toFixed(3);
                document.getElementById('globalGreenPoints').textContent = totalGlobalPt.toLocaleString();
            }

            const displayRecords = globalRecords.slice(0, 5);

            displayRecords.forEach(r => {
                let icon = 'fa-box';
                let colorClass = 'text-slate-400 bg-slate-100';
                if(r.typeId === 'pet' || r.typeId === 'cap') { icon = 'fa-bottle-water'; colorClass = 'text-blue-500 bg-blue-50'; }
                else if(r.typeId === 'can') { icon = 'fa-prescription-bottle'; colorClass = 'text-amber-500 bg-amber-50'; }
                else if(r.typeId === 'milk') { icon = 'fa-box-open'; colorClass = 'text-orange-500 bg-orange-50'; }
                else if(r.typeId === 'snack') { icon = 'fa-cookie'; colorClass = 'text-purple-500 bg-purple-50'; }

                let imgBadge = '';
                if(r.img) {
                    imgBadge = `<div class="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 border border-slate-200 inline-flex items-center"><i class="fa-solid fa-image mr-1"></i>เธกเธตเธฃเธนเธเธ เธฒเธ</div>`;
                }

                const avatarColors = ['bg-rose-100 text-rose-500 border-rose-200', 'bg-indigo-100 text-indigo-500 border-indigo-200', 'bg-amber-100 text-amber-500 border-amber-200'];
                const avatarStyle = avatarColors[r.id % avatarColors.length];

                const isMe = r.userMask === 'เธฃเธฒเธขเธเธฒเธฃเธเธญเธเธเธธเธ“ (You)';
                const itemClass = isMe ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:bg-slate-50';

                const html = `
                    <div class="flex items-start p-4 border rounded-2xl transition-colors ${itemClass}">
                        <div class="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm border-2 ${isMe ? 'bg-emerald-100 text-emerald-600 border-emerald-500 overflow-hidden' : avatarStyle}">
                            ${isMe ? '<img src="New Masqot.jpg" class="w-full h-full object-cover">' : '<i class="fa-solid fa-user"></i>'}
                        </div>
                        <div class="ml-4 flex-grow">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-sm font-bold text-slate-800">${r.userMask}</p>
                                    <p class="text-xs text-slate-500 mt-0.5">เธชเนเธ ${r.type} ${r.qty} เธเธดเนเธ ${imgBadge}</p>
                                </div>
                                <span class="text-[10px] text-slate-400 whitespace-nowrap ml-2"><i class="fa-regular fa-clock mr-1"></i>${r.date}</span>
                            </div>
                            <div class="mt-2 flex space-x-3">
                                <span class="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                    <i class="fa-solid fa-star mr-1"></i> +${r.point} Pt
                                </span>
                                <span class="inline-flex items-center text-xs font-medium text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                                    <i class="fa-solid fa-earth-asia mr-1"></i> -${r.carbon.toFixed(3)} kgCOโe
                                </span>
                            </div>
                        </div>
                    </div>
                `;
                feedContainer.insertAdjacentHTML('beforeend', html);
            });

            renderWasteChart();
        }

        // === Hero Level Distribution (Public Dashboard) ===
        // เธชเธตเธเธญเธเนเธ•เนเธฅเธฐ Bar เธญเธดเธเธ•เธฒเธกเธเธทเนเธญเธฃเธฐเธ”เธฑเธเน€เธชเธกเธญ (เนเธกเนเนเธเนเธ•เธฒเธกเธฅเธณเธ”เธฑเธเธเธฒเธฃเน€เธฃเธตเธขเธ) เน€เธเธทเนเธญเนเธซเนเธเธนเนเนเธเนเธเธณเธชเธตเธเธญเธเนเธ•เนเธฅเธฐ Badge เนเธ”เน
        const LEVEL_BAR_COLORS = {
            'Green Seed': 'from-lime-400 to-lime-500',
            'Green Tree': 'from-emerald-400 to-emerald-500',
            'Forest Guardian': 'from-teal-500 to-teal-600',
            'Carbon Hero': 'from-amber-400 to-amber-500',
            'Earth Legend': 'from-fuchsia-500 to-purple-600'
        };

        function renderLevelDistribution(participants, levels) {
            const container = document.getElementById('levelDistributionChart');
            if (!container) return;

            const list = Array.isArray(levels) ? levels : [];

            if (!list.length) {
                container.innerHTML = `<p class="text-sm text-slate-400 text-center py-4">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธเธนเนเน€เธเนเธฒเธฃเนเธงเธก</p>`;
                return;
            }

            // เธเนเธญเธกเธนเธฅเธเธฒเธ Backend เน€เธฃเธตเธขเธเธเธฒเธเธเธณเธเธงเธเธเธเธกเธฒเธ -> เธเนเธญเธขเนเธฅเนเธง เธเธงเธฒเธกเธขเธฒเธง Bar เธญเธดเธเธ•เธฒเธกเธชเธฑเธ”เธชเนเธงเธเธเธญเธเธฃเธฐเธ”เธฑเธเธ—เธตเนเธกเธตเธเธเธกเธฒเธเธ—เธตเนเธชเธธเธ”
            const maxCount = Math.max(...list.map(lv => lv.count || 0), 1);

            container.innerHTML = list.map(lv => {
                const color = LEVEL_BAR_COLORS[lv.name] || 'from-emerald-400 to-emerald-500';
                const targetWidth = Math.max((lv.count / maxCount) * 100, lv.count > 0 ? 3 : 0);
                return `
                    <div class="group cursor-pointer">
                        <div class="flex items-center justify-between mb-1.5 text-sm">
                            <span class="font-bold text-slate-700 flex items-center gap-1.5 group-hover:scale-105 transition-transform origin-left">
                                <span class="text-lg">${lv.icon}</span> ${lv.name}
                            </span>
                            <span class="text-xs font-semibold text-slate-500 group-hover:text-emerald-600 transition-colors">${(lv.count || 0).toLocaleString()} คน <span class="text-slate-400 font-normal">(${lv.percent || 0}%)</span></span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden progress-bar-animated">
                            <div class="level-dist-bar bg-gradient-to-r ${color} h-full rounded-full transition-all duration-1000 ease-out" style="width: 0%" data-target-width="${targetWidth}"></div>
                        </div>
                    </div>
                `;
            }).join('');

            // Animation เธ•เธญเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ: เธเธฅเนเธญเธขเนเธซเน browser เธงเธฒเธ” width: 0% เธเนเธญเธ เนเธฅเนเธงเธเนเธญเธข transition เนเธเธขเธฑเธเธเธงเธฒเธกเธเธงเนเธฒเธเธเธฃเธดเธ
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    container.querySelectorAll('.level-dist-bar').forEach(bar => {
                        bar.style.width = `${bar.dataset.targetWidth}%`;
                    });
                });
            });
        }

        function renderRecentActivities() {
            const container = document.getElementById('recentActivities');
            if (!container) return;
            const logs = [...userRecords].slice(0, 10);
            container.innerHTML = logs.length ? logs.map(log => `
                <div class="rounded-2xl border border-slate-100 p-3 bg-slate-50/70">
                    <div class="flex items-center justify-between mb-2">
                        <div class="font-semibold text-slate-700">${maskUsername(log.username || 'เธเธธเธ“')}</div>
                        <div class="text-[11px] text-slate-400">${log.date}</div>
                    </div>
                    <div class="text-sm text-slate-600">${log.type} โ€ข ${log.qty} เธเธดเนเธ</div>
                    <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span class="text-emerald-600 font-semibold">Green Point +${log.point || 0}</span>
                        <span class="text-teal-600 font-semibold">Carbon ${Number(log.carbon || 0).toFixed(3)} kg</span>
                    </div>
                </div>
            `).join('') : '<div class="text-sm text-slate-500">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ</div>';
        }

        function renderCarbonChart() {
            const canvas = document.getElementById('carbonChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (chartInstance) chartInstance.destroy();
            const labels = [];
            const data = [];
            const records = [...userRecords].sort((a, b) => new Date(a.dateTime || a.date) - new Date(b.dateTime || b.date));
            const grouped = {};
            records.forEach(record => {
                const d = new Date(record.dateTime || record.date);
                let key = '';
                if (currentChartRange === 'day') {
                    key = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
                } else if (currentChartRange === 'week') {
                    key = `เธชเธฑเธเธ”เธฒเธซเน ${Math.ceil((d.getDate() + 6) / 7)}`;
                } else {
                    key = d.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
                }
                grouped[key] = (grouped[key] || 0) + (record.carbon || 0);
            });
            Object.keys(grouped).forEach(key => {
                labels.push(key);
                data.push(grouped[key]);
            });
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Carbon Saved (kg)',
                        data,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                    },
                    scales: { y: { beginAtZero: true } },
                    zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
                },
                plugins: [ChartZoom]
            });
        }

        function renderRankings() {
            const facultyContainer = document.getElementById('topFacultyList');
            if (!facultyContainer) return;
            const facultyData = [...(dashboardData.facultyRanking || [])].sort((a, b) => (b.TotalGreenPoint || 0) - (a.TotalGreenPoint || 0));
            facultyContainer.innerHTML = facultyData.slice(0, 5).map((faculty, index) => `
                <div class="flex items-center justify-between p-2.5 rounded-xl ${index === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'} transition-colors group">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full ${index === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-200 text-orange-800' : 'bg-white text-slate-500 border border-slate-200'} font-bold flex items-center justify-center text-sm mr-3 shadow-sm group-hover:scale-110 transition-transform">
                            ${index + 1}
                        </div>
                        <div>
                            <p class="text-sm font-bold ${index === 0 ? 'text-amber-700' : 'text-slate-700'}">${faculty.Faculty || faculty.name || 'เนเธกเนเธฃเธฐเธเธธ'}</p>
                            <p class="text-[10px] ${index === 0 ? 'text-amber-600/70' : 'text-slate-500'}"><i class="fa-solid fa-users mr-1 opacity-70"></i> ${faculty.MemberCount || faculty.students || 0} เธเธเน€เธเนเธฒเธฃเนเธงเธก</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-black ${index === 0 ? 'text-amber-600' : 'text-emerald-600'}">${Number(faculty.TotalGreenPoint || 0).toLocaleString()} <span class="text-[10px] font-normal opacity-50">Pt</span></p>
                    </div>
                </div>
            `).join('');
        }

        function renderWasteChart() {
            const stats = { pet: 1200, can: 800, milk: 650, snack: 450, cap: 400 };
            
            globalRecords.forEach(r => {
                if(stats[r.typeId] !== undefined) {
                    stats[r.typeId] += r.qty;
                }
            });

            const total = Object.values(stats).reduce((a, b) => a + b, 0);
            document.getElementById('donutTotal').textContent = total.toLocaleString();

            const types = [
                { id: 'pet', name: 'เธเธงเธ” PET', color: '#10b981', dotClass: 'bg-emerald-500' },
                { id: 'can', name: 'เธเธฃเธฐเธเนเธญเธเธญเธฅเธนเธกเธดเน€เธเธตเธขเธก', color: '#f59e0b', dotClass: 'bg-amber-500' },
                { id: 'milk', name: 'เธเธฅเนเธญเธเธเธก UHT', color: '#f97316', dotClass: 'bg-orange-500' },
                { id: 'snack', name: 'เธเธญเธเธเธเธก', color: '#a855f7', dotClass: 'bg-purple-500' },
                { id: 'cap', name: 'เธเธฒเธเธงเธ”เธเนเธณ', color: '#3b82f6', dotClass: 'bg-blue-500' }
            ];

            const chartCanvas = document.getElementById('wasteDonutChart');
            const legendHTML = ['<div class="space-y-2.5">'];
            const values = [];
            const colors = [];
            let currentPerc = 0;

            types.forEach(t => {
                const qty = stats[t.id];
                const perc = total > 0 ? (qty / total) * 100 : 0;
                values.push(qty);
                colors.push(t.color);
                legendHTML.push(`
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center">
                            <span class="w-3 h-3 rounded-full ${t.dotClass} mr-2 shadow-sm"></span>
                            <span class="text-slate-600 font-medium">${t.name}</span>
                        </div>
                        <div class="text-right flex items-center space-x-2">
                            <span class="font-bold text-slate-800">${qty.toLocaleString()}</span>
                            <span class="text-xs text-slate-400 w-10 text-right bg-slate-50 px-1 py-0.5 rounded">${perc.toFixed(1)}%</span>
                        </div>
                    </div>
                `);
                currentPerc += perc;
            });
            legendHTML.push('</div>');
            document.getElementById('wasteLegend').innerHTML = legendHTML.join('');

            if (wasteChartInstance) {
                wasteChartInstance.destroy();
            }

            if (chartCanvas) {
                const tooltipEl = document.getElementById('custom-tooltip');
                if (window.ChartDataLabels) {
                    Chart.register(window.ChartDataLabels);
                }
                wasteChartInstance = new Chart(chartCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: types.map(t => t.name),
                        datasets: [{
                            data: values,
                            backgroundColor: colors,
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '72%',
                        onHover: (event, activeElements) => {
                            if (event.native && event.native.target) {
                                event.native.target.style.cursor = activeElements.length ? 'pointer' : 'default';
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: false,
                                external: (context) => {
                                    const { chart, tooltip } = context;
                                    if (tooltip.opacity === 0) {
                                        tooltipEl.style.opacity = '0';
                                        return;
                                    }

                                    const titleLines = tooltip.title || [];
                                    const bodyLines = tooltip.body.map(b => b.lines);
                                    const titleElement = document.getElementById('tooltip-title');
                                    const bodyElement = document.getElementById('tooltip-body');
                                    const rawValue = tooltip.dataPoints[0].raw;

                                    titleElement.innerHTML = titleLines[0] || 'เธเนเธญเธกเธนเธฅ';
                                    bodyElement.innerHTML = `เธเธณเธเธงเธ: ${rawValue.toLocaleString()} เธเธดเนเธ (${((rawValue / total) * 100).toFixed(1)}%)`;

                                    const canvasRect = chart.canvas.getBoundingClientRect();
                                    const containerRect = chartCanvas.parentElement.getBoundingClientRect();
                                    const left = canvasRect.left - containerRect.left + tooltip.caretX;
                                    const top = canvasRect.top - containerRect.top + tooltip.caretY;

                                    tooltipEl.style.opacity = '1';
                                    tooltipEl.style.left = `${left}px`;
                                    tooltipEl.style.top = `${top - 12}px`;
                                }
                            },
                            datalabels: {
                                display: false
                            }
                        },
                        animation: {
                            animateRotate: true,
                            duration: 800
                        }
                     }
                 });
             }
         }

        // Ripple effect for interactive cards
        document.addEventListener('click', function(e) {
            const card = e.target.closest('.card-hover-glow');
            if (!card) return;
            
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(16, 185, 129, 0.3);
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
                width: 100px;
                height: 100px;
                left: ${e.clientX - card.getBoundingClientRect().left - 50}px;
                top: ${e.clientY - card.getBoundingClientRect().top - 50}px;
            `;
            
            card.style.position = 'relative';
            card.style.overflow = 'hidden';
            card.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    

    // 3D Tilt Effect for cards
    function init3DTilt() {
        const cards = document.querySelectorAll('.card-3d-tilt');
        
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -8;
                const rotateY = ((x - centerX) / centerX) * 8;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.01)`;
                
                const shine = card.querySelector('.card-tilt-shine');
                if (shine) {
                    shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.3) 0%, transparent 60%)`;
                }
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
                
                const shine = card.querySelector('.card-tilt-shine');
                if (shine) {
                    shine.style.background = 'transparent';
                }
            });
        });
    }

    // Staggered Entrance Animation
    function initStaggeredEntrance() {
        const cards = document.querySelectorAll('.card-entrance');
        
        // Trigger entrance animation
        setTimeout(() => {
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.animationPlayState = 'running';
                }, index * 100);
            });
        }, 300);
    }

    // Initialize on page load
    window.addEventListener('load', () => {
        init3DTilt();
        initStaggeredEntrance();
    });

    // Re-initialize on dashboard switch
    window.addEventListener('dashboardSwitch', () => {
        setTimeout(() => {
            init3DTilt();
            initStaggeredEntrance();
        }, 100);
    });

    // Delete Confirmation Modal
    let deleteCallback = null;

    function showDeleteModal(callback) {
        deleteCallback = callback;
        const modal = document.getElementById('deleteModal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.bg-white').classList.remove('scale-95');
        }, 10);
    }

    function closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        modal.classList.add('opacity-0');
        modal.querySelector('.bg-white').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            deleteCallback = null;
        }, 300);
    }

    async function confirmDelete() {
        if (deleteCallback) {
            await deleteCallback();
        }
        closeDeleteModal();
    }

    // Loading Overlay
    function showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('hidden');
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.add('hidden');
    }
