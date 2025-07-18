const express = require('express');
const router = express.Router();
const {
    Login,
    Signup,
    ChangePassword,
    GetProfile,
    UpdateProfile,
    CreateAdmin,
    UpdateAdminProfile,
    GetAdmins,
    DeleteAdmin
} = require('../controllers/auth');
const { VerifyToken } = require('../middlewares');

// We only have POST, GET all, and PUT (by ID)
router
    .post('/login',
        Login
    )
    .post('/sign-up',
        Signup
    )
    .put('/change-password',
        VerifyToken(),
        ChangePassword
    )
    .put('/update-profile',
        VerifyToken(),
        UpdateProfile
    )
    .post('/create-admin',
        // VerifyToken(),
        CreateAdmin
    )
    .get('/list',
        VerifyToken(),
        GetAdmins
    )
    .put('/update-admin/:id',
        VerifyToken(),
        UpdateAdminProfile
    )
    .delete('/delete-admin/:id',
        VerifyToken(),
        DeleteAdmin
    )
    .get('/profile',
        VerifyToken(),
        GetProfile
    );

module.exports = router;
