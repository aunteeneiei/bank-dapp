/**
 * CSI301 Assignment 5: Bank Smart Contract interaction via Infura RPC
 * Author: นายอภิรักษ์ สงแจ้งใหญ่ (รหัส 66081358)
 * 
 * Usage:
 *   node scripts/bank-infura.js check
 *   node scripts/bank-infura.js deposit 0.001
 *   node scripts/bank-infura.js withdraw 0.0005
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load Environment / Defaults
const INFURA_API_KEY = process.env.INFURA_API_KEY || "YOUR_INFURA_API_KEY";
const INFURA_RPC_URL = process.env.INFURA_RPC_URL || `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

const ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function checkBlance() public view returns (uint256)",
    "event Deposit(address indexed owner, uint256 amount)",
    "event Withdraw(address indexed owner, uint256 amount)"
];

async function main() {
    console.log("==================================================");
    console.log("🏦 CSI301 Bank Smart Contract via Infura RPC");
    console.log("🎓 นักศึกษา: นายอภิรักษ์ สงแจ้งใหญ่ (66081358)");
    console.log("🌐 Infura RPC:", INFURA_RPC_URL.replace(/v3\/[a-zA-Z0-9]+/, "v3/****"));
    console.log("📄 Contract Address:", CONTRACT_ADDRESS);
    console.log("==================================================\n");

    const provider = new ethers.JsonRpcProvider(INFURA_RPC_URL);

    // Test Infura connection
    try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ เชื่อมต่อ Infura สำเร็จ! เครือข่าย: ${network.name} (ChainId: ${network.chainId}), Block ล่าสุด: #${blockNumber}\n`);
    } catch (err) {
        console.error("❌ ไม่สามารถเชื่อมต่อ Infura ได้ กรุณาตรวจสอบ INFURA_API_KEY / RPC_URL:", err.message);
        process.exit(1);
    }

    const command = process.argv[2] ? process.argv[2].toLowerCase() : "check";

    if (command === "check") {
        let targetAddress = process.argv[3];
        if (!targetAddress && PRIVATE_KEY) {
            const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
            targetAddress = wallet.address;
        }

        if (!targetAddress) {
            console.log("ℹ️  วิธีใช้งาน CheckBlance ผ่าน Infura:");
            console.log("   node scripts/bank-infura.js check <0xYourWalletAddress>");
            return;
        }

        console.log(`🔍 กำลังตรวจสอบยอดเงิน (CheckBlance) สำหรับ Address: ${targetAddress}...`);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        // Call checkBlance() simulating msg.sender = targetAddress
        const balanceWei = await contract.checkBlance.staticCall({ from: targetAddress });
        const balanceEth = ethers.formatEther(balanceWei);
        console.log(`💰 ยอดเงินคงเหลือในธนาคาร: ${balanceEth} ETH (${balanceWei.toString()} Wei)`);
        return;
    }

    // Commands that require transaction signing
    if (!PRIVATE_KEY) {
        console.error("❌ คำสั่ง", command, "จำเป็นต้องใช้ PRIVATE_KEY ในการลงนามธุรกรรม");
        console.error("   โปรดตั้งค่า PRIVATE_KEY=0x... ก่อนรันคำสั่ง");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    console.log(`🔑 กระเป๋าผู้ทำรายการ: ${wallet.address}`);

    if (command === "deposit") {
        const amountEth = process.argv[3] || "0.001";
        const weiVal = ethers.parseEther(amountEth);
        console.log(`📥 กำลังฝากเงินผ่าน Infura: ${amountEth} ETH (${weiVal} Wei)...`);

        const tx = await contract.deposit({ value: weiVal });
        console.log(`⏳ ส่งธุรกรรมแล้ว! Tx Hash: ${tx.hash}`);
        console.log(`🔗 ดูบน Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`🎉 ฝากเงินสำเร็จใน Block #${receipt.blockNumber}!`);

        const newBal = await contract.checkBlance();
        console.log(`💰 ยอดเงินคงเหลือใหม่: ${ethers.formatEther(newBal)} ETH`);
    } else if (command === "withdraw") {
        const amountEth = process.argv[3] || "0.0005";
        const weiVal = ethers.parseEther(amountEth);
        console.log(`📤 กำลังถอนเงินผ่าน Infura: ${amountEth} ETH (${weiVal} Wei)...`);

        const tx = await contract.withdraw(weiVal);
        console.log(`⏳ ส่งธุรกรรมแล้ว! Tx Hash: ${tx.hash}`);
        console.log(`🔗 ดูบน Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`🎉 ถอนเงินสำเร็จใน Block #${receipt.blockNumber}!`);

        const newBal = await contract.checkBlance();
        console.log(`💰 ยอดเงินคงเหลือใหม่: ${ethers.formatEther(newBal)} ETH`);
    } else {
        console.log("❓ ไม่พบคำสั่ง:", command);
        console.log("คำสั่งที่รองรับ: check, deposit <amount>, withdraw <amount>");
    }
}

main().catch((err) => {
    console.error("❌ เกิดข้อผิดพลาด:", err);
});
