# AutoScholar 研究报告：对比 Solidity 常见重入漏洞与访问控制漏洞的研究现状

## 1. 执行摘要
Current evidence suggests Solidity security research should be organized around vulnerability classes, exploit preconditions, and mitigation patterns. The system can research Solidity vulnerabilities directly, while x402 + Stacks remains only the premium payment rail used to unlock the report.

## 2. 研究范围与方法
AI Parliament workflow over topic evidence plus a separate x402/Stacks payment-rail evidence layer. Chair agenda: 界定比较范围：重入 vs 访问控制; 按证据强弱分层：框架/综述/专项研究; 梳理各自漏洞机理与典型攻击前提; 比较检测研究成熟度与方法细化程度; 比较修复模式与开发者实践证据; 区分架构性问题与实现性失误; 审查哪些结论证据不足或仅属推断; 单列支付层：x402 挑战与 Stacks 结算只影响访问，不影响研究结论

## 3. 核心发现
- Solidity vulnerability analysis is best structured as taxonomy + exploit path + mitigation.
- Reentrancy, access control, unsafe external calls, price/oracle assumptions, and upgradeability risks are recurrent security themes.
- Audit conclusions should distinguish architectural weaknesses from implementation bugs.
- x402 + Stacks belongs to the monetization layer, not the Solidity topic itself.

## 4. 综合分析
A topic-agnostic research agent should use domain-specific panels and keep x402 + Stacks as infrastructure.

## 5. 漏洞类别与缓解模式
### 5.1 漏洞类别
- reentrancy
- access control
- oracle manipulation
- upgradeability hazards
- unsafe external calls

### 5.2 缓解模式
- checks-effects-interactions
- role separation
- circuit breakers
- invariant testing
- upgrade review discipline

## 7. 启示与建议
- The product can sell premium security research workflows without forcing the topic to be about the payment rail.
- Topic-specific agents improve the credibility of the summary.

## 8. 证据综述
- **Solidity vulnerability taxonomy and exploit surface mapping** — 2026-03-12 · AutoScholar Topic Framework · local-framework
  - A topic scaffold covering reentrancy, access control failures, oracle manipulation, integer/precision pitfalls, upgradeability hazards, denial-of-service vectors, and unsafe external calls.
- **Security review patterns for Solidity systems** — 2026-03-12 · AutoScholar Topic Framework · local-framework
  - Security analysis should separate vulnerability class, exploit preconditions, realistic attack path, impact, mitigation pattern, and whether the issue is mostly architectural or implementation-specific.
- **[Securing Smart Contract Languages with a Unified Agentic Framework for Vulnerability Repair in Solidity and Move](https://arxiv.org/abs/2502.18515v2)** — 2025-02-22 · Rabimba Karanjai, Lei Xu, Weidong Shi · arxiv
  - The rapid growth of the blockchain ecosystem and the increasing value locked in smart contracts necessitate robust security measures. While languages like Solidity and Move aim to improve smart contract security, vulnerabilities persist. This paper presents Smartify, a novel multi-agent framework leveraging Large Language Models (LLMs) to automatically detect and repair vulnerabilities in Solidity and Move smart cont...
- **[Bridging the Gap: A Comparative Study of Academic and Developer Approaches to Smart Contract Vulnerabilities](https://arxiv.org/abs/2504.12443v2)** — 2025-04-16 · Francesco Salzano, Lodovica Marchesi, Cosmo Kevin Antenucci, Simone Scalabrino, Roberto Tonelli, Rocco Oliveto, Remo Pareschi · arxiv
  - In this paper, we investigate the strategies adopted by Solidity developers to fix security vulnerabilities in smart contracts. Vulnerabilities are categorized using the DASP TOP 10 taxonomy, and fixing strategies are extracted from GitHub commits in open-source Solidity projects. Each commit was selected through a two-phase process: an initial filter using natural language processing techniques, followed by manual v...
- **[Security Vulnerabilities in Ethereum Smart Contracts: A Systematic Analysis](https://arxiv.org/abs/2504.05968v4)** — 2025-04-08 · Jixuan Wu, Lei Xie, Xiaoqi Li · arxiv
  - Smart contracts are a secure and trustworthy application that plays a vital role in decentralized applications in various fields such as insurance,the internet, and gaming. However, in recent years, smart contract security breaches have occurred frequently, and due to their financial properties, they have caused huge economic losses, such as the most famous security incident "The DAO" which caused a loss of over $60 ...
- **[Reentrancy Vulnerability Identification in Ethereum Smart Contracts](https://arxiv.org/abs/2105.02881v1)** — 2021-05-06 · Noama Fatima Samreen, Manar H. Alalfi · arxiv
  - Ethereum Smart contracts use blockchain to transfer values among peers on networks without central agency. These programs are deployed on decentralized applications running on top of the blockchain consensus protocol to enable people to make agreements in a transparent and conflict-free environment. The security vulnerabilities within those smart contracts are a potential threat to the applications and have caused hu...

## 9. 局限性
- Some evidence may still be generic smart contract security literature rather than Solidity-only.

## 10. 后续研究方向
- Add explicit exploit-case retrievers for Solidity incident reports.
- Bind each vulnerability claim to evidence rows in the UI.
- Add an audit checklist export mode.

## 11. 参考文献
1. [1] Solidity vulnerability taxonomy and exploit surface mapping — AutoScholar Topic Framework · 2026-03-12 · local-framework。无公开链接。
2. [2] Security review patterns for Solidity systems — AutoScholar Topic Framework · 2026-03-12 · local-framework。无公开链接。
3. [3] [Securing Smart Contract Languages with a Unified Agentic Framework for Vulnerability Repair in Solidity and Move](https://arxiv.org/abs/2502.18515v2) — Rabimba Karanjai, Lei Xu, Weidong Shi · 2025-02-22 · arxiv
4. [4] [Bridging the Gap: A Comparative Study of Academic and Developer Approaches to Smart Contract Vulnerabilities](https://arxiv.org/abs/2504.12443v2) — Francesco Salzano, Lodovica Marchesi, Cosmo Kevin Antenucci, Simone Scalabrino, Roberto Tonelli, Rocco Oliveto, Remo Pareschi · 2025-04-16 · arxiv
5. [5] [Security Vulnerabilities in Ethereum Smart Contracts: A Systematic Analysis](https://arxiv.org/abs/2504.05968v4) — Jixuan Wu, Lei Xie, Xiaoqi Li · 2025-04-08 · arxiv
6. [6] [Reentrancy Vulnerability Identification in Ethereum Smart Contracts](https://arxiv.org/abs/2105.02881v1) — Noama Fatima Samreen, Manar H. Alalfi · 2021-05-06 · arxiv
