import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import dotenv from 'dotenv'

import { RateLimiter, VerifyCaptcha, VerifyTOTP } from './middlewares'
import EVM from './vms/evm'

import { SendTokenResponse } from './types'

import { evmchains, GLOBAL_RL, SEND_TOKEN_RL } from './config.json'

dotenv.config()

const app: any = express()
const router: any = express.Router();

app.use(cors())
app.use(bodyParser.json())

new RateLimiter(app, GLOBAL_RL);
new RateLimiter(app, SEND_TOKEN_RL);

const captcha = new VerifyCaptcha(app, process.env.CAPTCHA_SECRET!);
const totp = new VerifyTOTP(process.env.TOTPKEY!);

let evms: any = {};

evmchains.forEach((chain) => {
    const chainInstance = new EVM(chain, process.env[chain.NAME] || process.env.PK);
    
    evms[chain.NAME] = {
        config: chain,
        instance: chainInstance
    }
});

router.post('/sendToken', captcha.middleware, async (req: any, res: any) => {
    const address = req.body?.address;
    const chain = req.body?.chain;

    evms[chain]?.instance?.sendToken(address, (data: SendTokenResponse) => {
        const { status, message, txHash } = data;
        res.status(status).send({message, txHash})
    });
})

router.get('/recalibrate', totp.middleware, (req: any, res: any) => {
    const chain = req.query?.chain;
    evms[chain]?.instance?.recalibrateNonceAndBalance();
    res.send("Recalibrating now.")
})

router.get('/getChainConfigs', (req: any, res: any) => {
    res.send(evmchains)
})

router.get('/ip', (req: any, res: any) => {
    res.send(req.ip)
})

app.use('/api', router)

app.listen(process.env.PORT || 8000, () => {
    console.log(`Server started at port ${process.env.PORT || 8000}`)
})