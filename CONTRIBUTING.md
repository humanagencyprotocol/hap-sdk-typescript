# Contributing to HAP SDK

We welcome contributions that strengthen human agency, improve compliance, or harden the SDK. To contribute:

1. **Discuss changes first** – open an issue describing the problem or feature so we can align on scope.
2. **Follow the development workflow**  
   ```bash
   npm install
   npm run lint
   npm run test
   npm run build
   ```
   Run the full suite before submitting a pull request and ensure coverage stays ≥85%.
3. **Adhere to our privacy guarantees** – no PR should introduce telemetry or transmit semantic content to HAP services.
4. **Document everything** – update README/CHANGELOG and include tests for new behavior.
5. **Sign your commits if possible** – verified commits help downstream consumers trust the supply chain.

Please review the [Code of Conduct](./CODE_OF_CONDUCT.md) before participating and report security issues via [SECURITY.md](./SECURITY.md).
