#!/usr/bin/env node

const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
require('dotenv').config();
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');
const UPLOAD_URL = process.env.UPLOAD_URL || '';      // 订阅或节点自动上传地址,需填写部署Merge-sub项目后的首页地址,例如：https://merge.ct8.pl
const PROJECT_URL = process.env.PROJECT_URL || '';    // 需要上传订阅或保活时需填写项目分配的url,例如：https://google.com
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; // false关闭自动保活，true开启,需同时填写PROJECT_URL变量
const YT_WARPOUT = process.env.YT_WARPOUT || false;   // 设置为true时强制使用warp出站访问youtube,false时自动检测是否设置warp出站
const FILE_PATH = process.env.FILE_PATH || '.npm';    // sub.txt订阅文件路径
const SUB_PATH = process.env.SUB_PATH || 'sub';       // 订阅sub路径，默认为sub,例如：https://google.com/sub
const UUID = process.env.UUID || 'fc26ca88-9cfa-48df-a065-3cd90540709e';  // 在不同的平台运行了v1哪吒请修改UUID,否则会覆盖
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'agent.alpha.us.kg:80';         // 哪吒面板地址,v1形式：nz.serv00.net:8008  v0形式：nz.serv00.net
const NEZHA_PORT = process.env.NEZHA_PORT || '';             // v1哪吒请留空，v0 agent端口，当端口为{443,8443,2087,2083,2053,2096}时，自动开启tls
const NEZHA_KEY = process.env.NEZHA_KEY || 'gCNZBwoZ9WigfrzOzvgtNySHOfN78DPi';               // v1的NZ_CLIENT_SECRET或v0 agwnt密钥 
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'hidencloudus.kils.pp.ua';           // argo固定隧道域名,留空即使用临时隧道
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiYTBjN2ExMTEwZjIwZTgxMzMwYTAxN2VjOGQ5MjNmYzQiLCJ0IjoiMzU1NjhjMzctM2JhOS00ZTQ5LWIxY2EtOTJkMzA2YTBhNTM3IiwicyI6Ik1ETmhaamd3T0RNdFlUWTJPQzAwTkRWbExXSmpabU10WVRVeE16SXdOamt6TjJVeCJ9';               // argo固定隧道token或json,留空即使用临时隧道
const ARGO_PORT = process.env.ARGO_PORT || 8001;             // argo固定隧道端口,使用token需在cloudflare控制台设置和这里一致，否则节点不通
const S5_PORT = process.env.S5_PORT || '24647';                   // socks5端口，支持多端口的可以填写，否则留空
const TUIC_PORT = process.env.TUIC_PORT || '';               // tuic端口，支持多端口的可以填写，否则留空
const HY2_PORT = process.env.HY2_PORT || '27647';                 // hy2端口，支持多端口的可以填写，否则留空
const ANYTLS_PORT = process.env.ANYTLS_PORT || '';           // AnyTLS端口，支持多端口的可以填写，否则留空
const REALITY_PORT = process.env.REALITY_PORT || '';         // reality端口，支持多端口的可以填写，否则留空
const ANYREALITY_PORT = process.env.ANYREALITY_PORT || '';   // Anyr-eality端口，支持多端口的可以填写，否则留空
const CFIP = process.env.CFIP || 'saas.sin.fan';             // 优选域名或优选IP
const CFPORT = process.env.CFPORT || 443;                    // 优选域名或优选IP对应端口
const PORT = process.env.PORT || 3000;                       // http订阅端口    
const NAME = process.env.NAME || '';                         // 节点名称
const CHAT_ID = process.env.CHAT_ID || '';                   // Telegram chat_id  两个变量不全不推送节点到TG 
const BOT_TOKEN = process.env.BOT_TOKEN || '';               // Telegram bot_token 两个变量不全不推送节点到TG 
const DISABLE_ARGO = process.env.DISABLE_ARGO || false;      // 设置为 true 时禁用argo,false开启

//创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

let privateKey = '';
let publicKey = '';

// 生成随机6位字符函数
function generateRandomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成随机名称
const npmRandomName = generateRandomName();
const webRandomName = generateRandomName();
const botRandomName = generateRandomName();
const phpRandomName = generateRandomName();

// 使用随机文件名定义路径
let npmPath = path.join(FILE_PATH, npmRandomName);
let phpPath = path.join(FILE_PATH, phpRandomName);
let webPath = path.join(FILE_PATH, webRandomName);
let botPath = path.join(FILE_PATH, botRandomName);
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;

    const subPath = path.join(FILE_PATH, 'sub.txt');
    if (!fs.existsSync(subPath)) return;

    let fileContent;
    try {
      fileContent = fs.readFileSync(subPath, 'utf-8');
    } catch {
      return null;
    }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line => 
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    return axios.post(`${UPLOAD_URL}/api/delete-nodes`, 
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch((error) => { 
      return null; 
    });
  } catch (err) {
    return null;
  }
}

// 端口验证函数
function isValidPort(port) {
  try {
    if (port === null || port === undefined || port === '') ret
