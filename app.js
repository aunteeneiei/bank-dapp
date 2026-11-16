// CSI301 Assignment 5: Bank Smart Contract DApp Controller
// Author: นายอภิรักษ์ สงแจ้งใหญ่ (รหัส 66081358)
// Sripatum University

const DEFAULT_ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "Deposit",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "Withdraw",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "checkBlance",
        "outputs": [
            { "internalType": "uint256", "name": "balance", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let currentBankBalanceWei = 0n;

const STORAGE_KEY_CONTRACT = "csi301_bank_contract_address";

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Load saved contract address from localStorage
    const savedAddress = localStorage.getItem(STORAGE_KEY_CONTRACT) || "";
    if (savedAddress) {
        document.getElementById('inputContractAddress').value = savedAddress;
        updateContractStatus(savedAddress, true);
    }

    // 2. Setup button click listeners
    document.getElementById('btnConnectWallet').addEventListener('click', connectWallet);
    document.getElementById('btnConnectContract').addEventListener('click', handleConnectContract);
    document.getElementById('btnCheckBalance').addEventListener('click', checkBankBalance);
    document.getElementById('btnDeposit').addEventListener('click', handleDeposit);
    document.getElementById('btnWithdraw').addEventListener('click', handleWithdraw);
    document.getElementById('btnMaxWithdraw').addEventListener('click', handleMaxWithdraw);
    document.getElementById('btnClearLog').addEventListener('click', clearTxLogs);

    // 3. Listen to MetaMask account / network switches
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                resetWalletUI();
            } else {
                connectWallet();
            }
        });

        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });

        // Auto-connect if already authorized
        try {
            const tempProvider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await tempProvider.send("eth_accounts", []);
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (e) {
            console.log("Auto-connect check:", e);
        }
    }
});

// ==========================================
// 1. Connect MetaMask
// ==========================================
async function connectWallet() {
    if (!window.ethereum) {
        showStatusAlert('error', 'ไม่พบ MetaMask', 'กรุณาติดตั้งส่วนขยาย MetaMask ในเว็บบราวเซอร์ของคุณก่อนใช้งาน');
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        const network = await provider.getNetwork();
        const networkDisplay = network.name === 'unknown' ? `Chain: ${network.chainId}` : network.name;

        // Update Wallet UI
        document.getElementById('networkName').innerText = networkDisplay;
        document.getElementById('userAccount').innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        document.getElementById('userAccount').title = userAddress;

        document.getElementById('btnConnectWallet').classList.add('hidden');
        document.getElementById('connectedBox').classList.remove('hidden');

        await refreshWalletBalance();

        // Connect Contract if address is present
        const contractAddress = document.getElementById('inputContractAddress').value.trim();
        if (contractAddress && ethers.isAddress(contractAddress)) {
            initContractInstance(contractAddress);
        }

        showStatusAlert('success', 'เชื่อมต่อ MetaMask สำเร็จ', `บัญชี: ${userAddress} บนเครือข่าย ${networkDisplay}`);
    } catch (err) {
        console.error("connectWallet error:", err);
        showStatusAlert('error', 'เชื่อมต่อ MetaMask ล้มเหลว', err.message || err);
    }
}

function resetWalletUI() {
    userAddress = null;
    signer = null;
    contract = null;
    document.getElementById('btnConnectWallet').classList.remove('hidden');
    document.getElementById('connectedBox').classList.add('hidden');
    document.getElementById('bankBalanceDisplay').innerText = "0.0000";
    document.getElementById('bankBalanceWeiDisplay').innerText = "0";
}

async function refreshWalletBalance() {
    if (!provider || !userAddress) return;
    try {
        const bal = await provider.getBalance(userAddress);
        const ethVal = parseFloat(ethers.formatEther(bal)).toFixed(4);
        document.getElementById('userBalance').innerText = `${ethVal} ETH`;
    } catch (e) {
        console.error("refreshWalletBalance error:", e);
    }
}

// ==========================================
// 2. Connect Smart Contract
// ==========================================
function handleConnectContract() {
    const addr = document.getElementById('inputContractAddress').value.trim();
    if (!addr) {
        showStatusAlert('warning', 'กรุณาระบุ Contract Address', 'โปรดใส่ที่อยู่ Smart Contract ของ Bank.sol ที่ Deploy แล้ว');
        return;
    }

    if (!ethers.isAddress(addr)) {
        showStatusAlert('error', 'Contract Address ไม่ถูกต้อง', 'รูปแบบ Ethereum Address ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0x และมี 42 ตัวอักษร)');
        return;
    }

    localStorage.setItem(STORAGE_KEY_CONTRACT, addr);
    initContractInstance(addr);
}

function initContractInstance(address) {
    if (!signer) {
        updateContractStatus(address, true, 'รอเชื่อมต่อ MetaMask');
        showStatusAlert('info', 'บันทึก Contract Address แล้ว', 'กรุณากดปุ่ม "เชื่อมต่อ MetaMask" ด้านบนขวาเพื่อเริ่มทำธุรกรรม');
        return;
    }

    try {
        contract = new ethers.Contract(address, DEFAULT_ABI, signer);
        updateContractStatus(address, true, 'เชื่อมต่อสำเร็จ พร้อมใช้งาน');
        showStatusAlert('success', 'เชื่อมต่อ Smart Contract สำเร็จ', `Smart Contract Bank พร้อมใช้งานที่: ${address}`);

        // Listen to Events
        listenToContractEvents();

        // Check balance automatically upon connection
        checkBankBalance();
    } catch (err) {
        console.error("initContractInstance error:", err);
        updateContractStatus(address, false, 'เกิดข้อผิดพลาดในการโหลดสัญญา');
        showStatusAlert('error', 'เชื่อมต่อ Contract ล้มเหลว', err.message || err);
    }
}

function updateContractStatus(address, isOk, customMsg) {
    const statusBadge = document.getElementById('contractStatusBadge');
    const statusText = document.getElementById('contractStatusText');
    const linkEtherscan = document.getElementById('linkEtherscanContract');

    if (isOk) {
        statusBadge.innerHTML = `
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>สถานะสัญญา: <span class="text-emerald-400 font-medium">${customMsg || 'เชื่อมต่อพร้อมใช้งาน'}</span> (${address.substring(0, 8)}...${address.substring(address.length - 6)})</span>
        `;
        linkEtherscan.href = `https://sepolia.etherscan.io/address/${address}`;
        linkEtherscan.classList.remove('hidden');
    } else {
        statusBadge.innerHTML = `
            <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span>สถานะสัญญา: <span class="text-red-400 font-medium">${customMsg || 'ไม่สามารถเชื่อมต่อได้'}</span></span>
        `;
        linkEtherscan.classList.add('hidden');
    }
}

// ==========================================
// 3. CheckBlance (ตรวจสอบยอดเงินคงเหลือ)
// ==========================================
async function checkBankBalance() {
    if (!contract) {
        if (!signer) {
            showStatusAlert('warning', 'กรุณาเชื่อมต่อ MetaMask', 'ต้องเชื่อมต่อกระเป๋าก่อนจึงจะสามารถตรวจสอบยอดเงินได้');
        } else {
            showStatusAlert('warning', 'กรุณาระบุและเชื่อมต่อ Smart Contract', 'โปรดระบุ Contract Address ด้านบนและกดเชื่อมต่อสัญญา');
        }
        return;
    }

    const icon = document.getElementById('iconRefresh');
    if (icon) icon.classList.add('rotate-180');

    try {
        // Calling checkBlance() exactly as defined in the slide contract
        const balanceWei = await contract.checkBlance();
        currentBankBalanceWei = BigInt(balanceWei.toString());

        const balanceEth = ethers.formatEther(currentBankBalanceWei);
        document.getElementById('bankBalanceDisplay').innerText = parseFloat(balanceEth).toFixed(4);
        document.getElementById('bankBalanceWeiDisplay').innerText = currentBankBalanceWei.toString();

        await refreshWalletBalance();

        showStatusAlert('success', 'ตรวจสอบยอดเงินสำเร็จ', `ยอดเงินคงเหลือในธนาคาร: ${balanceEth} ETH (${currentBankBalanceWei.toString()} Wei)`);
    } catch (err) {
        console.error("checkBlance error:", err);
        showStatusAlert('error', 'ตรวจสอบยอดเงินล้มเหลว', err.reason || err.message || err);
    } finally {
        setTimeout(() => {
            if (icon) icon.classList.remove('rotate-180');
        }, 500);
    }
}

// ==========================================
// 4. Deposit (ฝากเงิน)
// ==========================================
async function handleDeposit() {
    if (!contract || !signer) {
        showStatusAlert('warning', 'ยังไม่ได้เชื่อมต่อ', 'กรุณาเชื่อมต่อ MetaMask และ Smart Contract ก่อนฝากเงิน');
        return;
    }

    const amountInput = document.getElementById('depositAmount');
    const amountVal = amountInput.value.trim();

    if (!amountVal || parseFloat(amountVal) <= 0) {
        showStatusAlert('warning', 'จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวน ETH ที่มากกว่า 0 เพื่อทำการฝาก');
        amountInput.focus();
        return;
    }

    const btn = document.getElementById('btnDeposit');
    const originalBtnHtml = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            <span>กำลังส่งธุรกรรม...</span>
        `;

        const weiValue = ethers.parseEther(amountVal);
        showStatusAlert('info', 'กำลังส่งธุรกรรมฝากเงิน (Deposit)', `จำนวน: ${amountVal} ETH กรุณายืนยันบนกระเป๋า MetaMask...`);

        const tx = await contract.deposit({ value: weiValue });
        showStatusAlert('info', 'ธุรกรรมกำลังรอยืนยัน (Pending)', `Tx Hash: ${tx.hash}`, tx.hash);

        const receipt = await tx.wait();
        showStatusAlert('success', 'ฝากเงินเข้าธนาคารสำเร็จ! (Deposit Success)', `ทำรายการสำเร็จเรียบร้อยใน Block #${receipt.blockNumber}`, tx.hash);

        // Reset input and refresh balances
        amountInput.value = '';
        await checkBankBalance();
        await refreshWalletBalance();

        // Add to log if event didn't trigger
        addTxLogEntry('Deposit', userAddress, amountVal, weiValue.toString(), tx.hash);
    } catch (err) {
        console.error("Deposit error:", err);
        showStatusAlert('error', 'การฝากเงินล้มเหลว', err.reason || err.message || err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

// Preset helper for deposit
window.setDepositAmount = function(val) {
    const input = document.getElementById('depositAmount');
    if (input) input.value = val;
};

// ==========================================
// 5. Withdraw (ถอนเงิน)
// ==========================================
async function handleWithdraw() {
    if (!contract || !signer) {
        showStatusAlert('warning', 'ยังไม่ได้เชื่อมต่อ', 'กรุณาเชื่อมต่อ MetaMask และ Smart Contract ก่อนถอนเงิน');
        return;
    }

    const amountInput = document.getElementById('withdrawAmount');
    const amountVal = amountInput.value.trim();

    if (!amountVal || parseFloat(amountVal) <= 0) {
        showStatusAlert('warning', 'จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวน ETH ที่มากกว่า 0 เพื่อทำการถอน');
        amountInput.focus();
        return;
    }

    const weiAmount = ethers.parseEther(amountVal);
    if (weiAmount > currentBankBalanceWei) {
        showStatusAlert('warning', 'ยอดเงินไม่เพียงพอ (Not enough money)', `ยอดเงินในธนาคารของคุณมีเพียง ${ethers.formatEther(currentBankBalanceWei)} ETH ไม่สามารถถอน ${amountVal} ETH ได้`);
        return;
    }

    const btn = document.getElementById('btnWithdraw');
    const originalBtnHtml = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            <span>กำลังส่งธุรกรรม...</span>
        `;

        showStatusAlert('info', 'กำลังส่งธุรกรรมถอนเงิน (Withdraw)', `จำนวน: ${amountVal} ETH กรุณายืนยันบนกระเป๋า MetaMask...`);

        const tx = await contract.withdraw(weiAmount);
        showStatusAlert('info', 'ธุรกรรมกำลังรอยืนยัน (Pending)', `Tx Hash: ${tx.hash}`, tx.hash);

        const receipt = await tx.wait();
        showStatusAlert('success', 'ถอนเงินออกจากธนาคารสำเร็จ! (Withdraw Success)', `เงินเข้ากระเป๋าของคุณแล้วใน Block #${receipt.blockNumber}`, tx.hash);

        // Reset input and refresh balances
        amountInput.value = '';
        await checkBankBalance();
        await refreshWalletBalance();

        // Add to log if event didn't trigger
        addTxLogEntry('Withdraw', userAddress, amountVal, weiAmount.toString(), tx.hash);
    } catch (err) {
        console.error("Withdraw error:", err);
        showStatusAlert('error', 'การถอนเงินล้มเหลว', err.reason || err.message || err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

function handleMaxWithdraw() {
    if (currentBankBalanceWei <= 0n) {
        showStatusAlert('info', 'ยอดเงินเป็นศูนย์', 'ไม่มียอดเงินคงเหลือในธนาคารให้ถอน');
        return;
    }
    const maxEth = ethers.formatEther(currentBankBalanceWei);
    document.getElementById('withdrawAmount').value = maxEth;
}

window.setWithdrawPercentage = function(pct) {
    if (currentBankBalanceWei <= 0n) {
        showStatusAlert('info', 'ยอดเงินเป็นศูนย์', 'ไม่มียอดเงินคงเหลือในธนาคารให้ถอน');
        return;
    }
    const amountWei = (currentBankBalanceWei * BigInt(pct)) / 100n;
    const amountEth = ethers.formatEther(amountWei);
    document.getElementById('withdrawAmount').value = amountEth;
};

// ==========================================
// 6. Contract Event Listeners
// ==========================================
function listenToContractEvents() {
    if (!contract) return;

    try {
        contract.removeAllListeners();

        contract.on('Deposit', (owner, amount, event) => {
            console.log('Event Deposit received:', owner, amount);
            const ethVal = ethers.formatEther(amount);
            addTxLogEntry('Deposit', owner, ethVal, amount.toString(), event?.log?.transactionHash || '-');
            if (userAddress && owner.toLowerCase() === userAddress.toLowerCase()) {
                checkBankBalance();
            }
        });

        contract.on('Withdraw', (owner, amount, event) => {
            console.log('Event Withdraw received:', owner, amount);
            const ethVal = ethers.formatEther(amount);
            addTxLogEntry('Withdraw', owner, ethVal, amount.toString(), event?.log?.transactionHash || '-');
            if (userAddress && owner.toLowerCase() === userAddress.toLowerCase()) {
                checkBankBalance();
            }
        });
    } catch (e) {
        console.error("listenToContractEvents error:", e);
    }
}

// ==========================================
// 7. Activity History Table
// ==========================================
function addTxLogEntry(type, owner, ethAmount, weiAmount, txHash) {
    const tableBody = document.getElementById('txLogTableBody');
    const noTxRow = document.getElementById('noTxRow');
    if (noTxRow) noTxRow.remove();

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/60 transition';

    const isDeposit = type === 'Deposit';
    const badgeHtml = isDeposit
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">📥 Deposit</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">📤 Withdraw</span>`;

    const shortOwner = `${owner.substring(0, 6)}...${owner.substring(owner.length - 4)}`;
    const timeStr = new Date().toLocaleTimeString('th-TH');

    const txLinkHtml = (txHash && txHash !== '-')
        ? `<a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" class="text-sky-400 hover:underline">${txHash.substring(0, 8)}...</a>`
        : `<span class="text-slate-600">-</span>`;

    tr.innerHTML = `
        <td class="py-3 px-4">${badgeHtml}</td>
        <td class="py-3 px-4 text-slate-300 font-mono" title="${owner}">${shortOwner}</td>
        <td class="py-3 px-4 text-right font-mono font-medium ${isDeposit ? 'text-emerald-400' : 'text-amber-400'}">${ethAmount} ETH</td>
        <td class="py-3 px-4 text-right font-mono text-slate-400">${weiAmount}</td>
        <td class="py-3 px-4 text-center text-slate-400">${timeStr}</td>
        <td class="py-3 px-4 text-center">${txLinkHtml}</td>
    `;

    tableBody.insertBefore(tr, tableBody.firstChild);
}

function clearTxLogs() {
    const tableBody = document.getElementById('txLogTableBody');
    tableBody.innerHTML = `
        <tr id="noTxRow">
            <td colspan="6" class="py-8 text-center text-slate-500 font-sans">
                ยังไม่มีรายการธุรกรรมในเซสชันนี้ — เมื่อทำการฝากหรือถอนเงิน รายการจะแสดงขึ้นที่นี่อัตโนมัติ
            </td>
        </tr>
    `;
}

// ==========================================
// 8. Notification Alert Helper
// ==========================================
function showStatusAlert(type, title, msg, txHash = null) {
    const alertBox = document.getElementById('statusAlertBox');
    const icon = document.getElementById('statusIcon');
    const titleEl = document.getElementById('statusTitle');
    const msgEl = document.getElementById('statusMessage');
    const txHashEl = document.getElementById('statusTxHash');

    alertBox.className = 'rounded-xl p-4 border text-sm transition-all flex items-start space-x-3 mb-4 ';

    if (type === 'success') {
        alertBox.className += 'bg-emerald-950/60 border-emerald-800 text-emerald-200';
        icon.innerText = '✅';
    } else if (type === 'error') {
        alertBox.className += 'bg-rose-950/60 border-rose-800 text-rose-200';
        icon.innerText = '❌';
    } else if (type === 'warning') {
        alertBox.className += 'bg-amber-950/60 border-amber-800 text-amber-200';
        icon.innerText = '⚠️';
    } else {
        alertBox.className += 'bg-sky-950/60 border-sky-800 text-sky-200';
        icon.innerText = 'ℹ️';
    }

    titleEl.innerText = title;
    msgEl.innerText = msg;

    if (txHash) {
        txHashEl.innerHTML = `ลิงก์ธุรกรรมบน Etherscan: <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" class="underline text-sky-300 font-mono">${txHash}</a>`;
        txHashEl.classList.remove('hidden');
    } else {
        txHashEl.classList.add('hidden');
    }

    alertBox.classList.remove('hidden');
}

window.hideStatusAlert = function() {
    const alertBox = document.getElementById('statusAlertBox');
    if (alertBox) alertBox.classList.add('hidden');
};
