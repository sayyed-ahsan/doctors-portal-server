const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_ACCESS);
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//---------------
//---------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.l0zxzgu.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
//---------------
function veryfyJWT(req, res, next) {
    const authHeader = req.headers.authuraization;
    if (!authHeader) {
        return res.status(401).send('unauthorize access');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'fobiden access' })
        }
        req.decoded = decoded;
        next();
    })

}
//---------------
async function run() {
    try {
        //----------------- 
        const appoinmentOptionsCullection = client.db('doctorsPortal').collection('appoinmentOptions');
        const bookingCullection = client.db('doctorsPortal').collection('bookings');
        const userCullection = client.db('doctorsPortal').collection('users');
        const doctorsCullection = client.db('doctorsPortal').collection('doctors');
        const paymentsCollection = client.db('doctorsPortal').collection('payments');
        //-----------------
        //-----------------
        // app.get('/update', async (req, res) => {
        //     const quary = {}
        //     const option = { upsert: true }
        //     const updatetdoc = {
        //         $set: {
        //             price: 99
        //         }
        //     }
        //     const resust = await appoinmentOptionsCullection.updateMany(quary, updatetdoc, option);
        //     res.send(resust);
        // });



        //-----------------
        //-----------------
        // NOTE: make sure you use verifyAdmin after verifyJWT
        // const verifyAdmin = async (req, res, next) => {
        //     const decodedEmail = req.decoded.email;
        //     const query = { email: decodedEmail };
        //     const user = await userCullection.findOne(query);

        //     if (user?.role !== 'admin') {
        //         return res.status(403).send({ message: 'forbidden access' })
        //     }
        //     next();
        // }
        //-----------------
        //-----------------
        app.get('/appoinmentOptions', async (req, res) => {
            const quary = {}
            const options = await appoinmentOptionsCullection.find(quary).toArray();
            res.send(options);
        });
        //-----------------
        app.get('/bookingss', veryfyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ message: 'fobiden access' })
            }
            const quary = { email: email }
            const bookings = await bookingCullection.find(quary).toArray();
            res.send(bookings);
        });
        //-----------------
        app.get('/bookings/:bookingId', async (req, res) => {
            const id = req.params.bookingId;
            const quary = { _id: ObjectId(id) }
            const booking = await bookingCullection.findOne(quary);
            res.send(booking);
        });
        //-----------------
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCullection.insertOne(booking);
            res.send(result);
            // console.log(booking)
        });
        //-----------------
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const quary = { email: email }
            const user = await userCullection.findOne(quary);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '3h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
            // res.send(user);
            // console.log(email, user)
        });
        //-----------------
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCullection.insertOne(user);
            res.send(result);
        });
        //-----------------
        app.get('/users', async (req, res) => {
            const quary = {}
            const result = await userCullection.find(quary).toArray();
            res.send(result);
        });
        //-----------------
        app.get('/appoinmentSpecility', async (req, res) => {
            const quary = {}
            const options = await appoinmentOptionsCullection.find(quary).project({ name: 1 }).toArray();
            res.send(options);
            console.log(options)
        });
        //-----------------
        app.post('/doctors', async (req, res) => {
            const user = req.body;
            const result = await doctorsCullection.insertOne(user);
            res.send(result);
        });
        //-----------------
        app.get('/doctors', async (req, res) => {
            const quary = {}
            const resust = await doctorsCullection.find(quary).toArray();
            res.send(resust);
        })
        //-----------------
        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const option = { upsert: true }
            const filter = { _id: ObjectId(id) }
            const updatDoc = {
                $set: {
                    role: "admin"
                }
            }
            const resust = await userCullection.updateOne(filter, updatDoc, option);
            res.send(resust);

        })
        //-----------------
        //-----------------
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        //-----------------
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userCullection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })
        //-----------------
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCullection.updateOne(filter, updatedDoc)
            res.send(result);
        })
        //-----------------
        //-----------------
        //-----------------
        //-----------------

    }
    finally {

    }
}

run().catch(console.log)



app.get('/', async (req, res) => {
    res.send('runing on 123456')
})

app.listen(port, () => console.log(`runing on ${port}`))