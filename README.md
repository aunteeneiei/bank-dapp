# 🏦 Bank Smart Contract DApp

> **วิชา:** CSI301 การพัฒนาสมาร์ตคอนแทร็กต์ (Smart Contract Development)  
> **อาจารย์ผู้สอน:** มหาวิทยาลัยศรีปทุม (Sripatum University)  
> **ผู้พัฒนา:** นายอภิรักษ์ สงแจ้งใหญ่ (รหัสนักศึกษา: `66081358`)  
> **🌐 เว็บ DApp (Live Demo):** [https://aunteeneiei.github.io/bank-dapp/](https://aunteeneiei.github.io/bank-dapp/)  
> **📦 GitHub Repository:** [https://github.com/aunteeneiei/bank-dapp](https://github.com/aunteeneiei/bank-dapp)  

---

## 🌟 ภาพรวมระบบ (System Overview)

เว็บแอปพลิเคชันกระจายศูนย์ (DApp) สำหรับเชื่อมต่อและทำธุรกรรมกับ Smart Contract ระบบธนาคาร (`Bank.sol`) บนเครือข่าย Ethereum Sepolia Testnet รองรับทั้งการเชื่อมต่อผ่าน **MetaMask** และผ่าน **Infura RPC Gateway**:

1. **โหมดการเชื่อมต่อ RPC Node:**
   - 🦊 **MetaMask Mode (Injected Web3 Provider):** เชื่อมต่อกระเป๋าเงิน MetaMask สำหรับอ่านและลงนามส่งธุรกรรม
   - ⚡ **Infura RPC Mode:** เชื่อมต่อตรงสู่โหนด Ethereum ผ่าน Infura RPC Gateway (`https://sepolia.infura.io/v3/YOUR_API_KEY`) เพื่อดึงข้อมูลสถานะและยอดคงเหลือโดยตรง
2. **การเชื่อมต่อ Smart Contract:** ระบุ Contract Address และเชื่อมต่อ ABI ของ Bank contract
3. **CheckBlance:** ตรวจสอบยอดเงินฝากคงเหลือในธนาคารผ่านฟังก์ชัน `checkBlance()`
4. **Deposit:** ฝากเหรียญ ETH เข้าสู่ธนาคารผ่านฟังก์ชัน payable `deposit()`
5. **Withdraw:** ถอนเหรียญ ETH ออกจากธนาคารกลับเข้ากระเป๋าผ่านฟังก์ชัน `withdraw(amount)`
6. **แสดงข้อมูลนักศึกษา:** แสดงรหัสนักศึกษา (`66081358`) และชื่อ-สกุล บนหน้าเว็บอย่างชัดเจน
7. **Deploy บน GitHub Pages:** เปิดให้เข้าใช้งานและทดสอบได้ผ่านลิงก์สาธารณะ
8. **Infura Node.js CLI Script (`scripts/bank-infura.js`):** สคริปต์สำหรับการเรียกใช้งาน Smart Contract ผ่าน Infura RPC โดยตรงผ่าน Terminal

---

## ⚡ การใช้งานผ่าน Infura Node.js Script

```bash
# ตรวจสอบยอดเงินคงเหลือผ่าน Infura
node scripts/bank-infura.js check 0xYourWalletAddress

# ฝากเงินเข้าธนาคารผ่าน Infura (ต้องระบุ PRIVATE_KEY และ CONTRACT_ADDRESS)
CONTRACT_ADDRESS=0x... PRIVATE_KEY=0x... node scripts/bank-infura.js deposit 0.001

# ถอนเงินออกจากธนาคารผ่าน Infura
CONTRACT_ADDRESS=0x... PRIVATE_KEY=0x... node scripts/bank-infura.js withdraw 0.0005
```

---

## 📄 โค้ด Smart Contract (`contracts/Bank.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Bank {
    mapping (address => uint) _balances;
    event Deposit(address indexed owner, uint amount);
    event Withdraw(address indexed owner, uint amount);

    function deposit() public payable {
        require(msg.value > 0, "Deposit money is zero");
        _balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint amount) public {
        require(amount > 0 && amount <= _balances[msg.sender], "not enough money");
        payable(msg.sender).transfer(amount);
        _balances[msg.sender] -= amount;
        emit Withdraw(msg.sender, amount);
    }

    function checkBlance() public view returns(uint balance) {
        return _balances[msg.sender];
    }
}
```

---

## 🚀 สถาปัตยกรรมเทคโนโลยี (Tech Stack)

- **Smart Contract:** Solidity ^0.8.0
- **Blockchain Network:** Ethereum Sepolia Testnet
- **Web3 Library:** Ethers.js v6 (BrowserProvider, Contract, Signer)
- **Frontend:** HTML5, Modern Tailwind CSS (Glassmorphism UI), Google Font (Kanit)
- **Hosting & CI/CD:** GitHub Pages
