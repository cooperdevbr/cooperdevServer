const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mailer = require('../../modules/mailer')

const authConfig = require('../../config/auth')

const User = require('../models/User');

const router = express.Router();

function generateToken(params = {}) {
    
    return jwt.sign(params, authConfig.secret, { expiresIn: 50000});
}

router.post('/register', async(req, res) => {
    const {email} = req.body;
    
    try {
        if (await User.findOne({email}))
        return res.status(400).send({error: 'Usuario Ja existe'});

        const user = await User.create(req.body);

        user.password = undefined;

        return res.send({user, token: generateToken({id: user.id})});
    } catch (err) {
        res.status(400).send({ error: 'Falha no Registro'});
    }
});

router.post('/autenticate', async(req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({email}).select('+password');

    if (!user)
        return res.status(400).send({error: 'Usuario não encontrado'});

    if (!await bcrypt.compare(password, user.password))
        return res.status(400).send({error: 'Usuário/Senha Inválido'});

    user.password = undefined;


    res.send({user, token: generateToken({id: user.id})});


});

router.post('/forgot_password', async (req, res) => {
    const {email} = req.body;

    try {
        const user = await User.findOne({email});

        if (!user)
            return res.status(400).send({error: 'Usuario não encontrado'});
        
        const token = crypto.randomBytes(20).toString('hex');

        const now = new Date();
        now.setHours(now.getHours()+1);

        await User.findByIdAndUpdate(user.id, {
            '$set': {
                passwordResetToken: token,
                passwordResetExpires: now
            }
        });

        mailer.sendMail({
            to: email,
            from: 'contato@cooperdev.com.br',
            template: 'auth/forgot_password',
            context: {token}
        }, (err) => {
            if(err)
                return res.status(400).send({error: 'Não consigo enviar email'});
            return res.send();
        })

    } catch (err) {
        req.status(400).send({error: 'Erro esqueci senha, tente novamente'})
    }
});

router.post('/reset_password', async(req, res) => {
    const {email, token, password} = req.body;

    try {
        const user = await User.findOne({email})
            .select('+passwordResetToken passwordResetExpires');

        if (!user)
            return res.status(400).send({error: 'Usuario não encontrado'});

        if(token !== user.passwordResetToken)
            return res.status(400).send({error: 'Token Invalido'});

        const now = Date();

        if (now > user.passwordResetExpires)
            return res.status(400).send({error: 'Token Expirado'});

        user.password = password;

        await user.save();

        res.send();
        
    } catch (err) {
        res.status(400).send({ error: 'Não posso resetar o usuário'})
    }
});

module.exports = app => app.use('/auth', router);