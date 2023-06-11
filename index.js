const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


// JWT token 
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // Bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  })

}

// Pass: DObLeftNP0by7thh



// const uri = "mongodb+srv://<username>:<password>@cluster0.vvvwsgj.mongodb.net/?retryWrites=true&w=majority";
const uri = "mongodb+srv://summerCamp:DObLeftNP0by7thh@cluster0.vvvwsgj.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("summerCamp").collection("users");
    const classesCollection = client.db("summerCamp").collection("classes");
    const instructorsCollection = client.db("summerCamp").collection("instructors");
    const enrollCollection = client.db("summerCamp").collection("allEnroll");
    const paymentCollection = client.db("summerCamp").collection("payments")




    // JWT 
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // VerifyAdmin Api 

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // User APIS

    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);

    });


    app.get('/users', verifyJWT,  async(req, res)=>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // User update related api 

    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateUser = {
        $set: {
          role: 'admin'
        },
      }
      const result = await usersCollection.updateOne(query, updateUser)
      res.send(result)
    })
    
    app.patch('/users/instructor/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateUser = {
        $set: {
          role: 'instructor' 
        },
      }
      const result = await usersCollection.updateOne(query, updateUser)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
    
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
    
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    // User Delete Api 
    app.delete('/user-delete/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    


    // Classes API 

    app.get('/classes', async (req, res) =>{
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    // Instructors API 

    app.get('/instructors', async (req, res) =>{
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    })

    // Enroll related API 

    app.post('/all-enroll', async(req, res)=>{
      const enroll = req.body;
      const result = await enrollCollection.insertOne(enroll);
      res.send(result)
    })
    
    app.get('/enroll', verifyJWT,  async(req, res)=>{
      const email = req.query.email;
      // console.log(email)
      if(!email){
       return res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: True, message: 'porviden access'})
      }
    
      const query = {email: email};
      // console.log(query)
      const result = await enrollCollection.find(query).toArray();
      res.send(result)
    })

// Delete enroll selected class 

    app.delete('/enroll/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await enrollCollection.deleteOne(query)
      res.send(result)
    })


       // create payment intent
       app.post('/create-payment-intent', verifyJWT, async (req, res) => {
        const { price } = req.body;
        const amount = price * 100
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        })
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      })
      // Payment related api 
      app.post('/payments', verifyJWT, async (req, res) => {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);
        const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
        const deleteResult = await enrollCollection.deleteMany(query)
        res.send({ insertResult, deleteResult });
      })

      app.get('/my-enroll-class', verifyJWT, async(req, res)=>{
        const email = req.query.email;
        // console.log(email)
        if(!email){
         return res.send([]);
        }
        const decodedEmail = req.decoded.email;
        if(email !== decodedEmail){
          return res.status(403).send({error: True, message: 'forbidden access'})
        }
      
        const query = {email: email};
        // console.log(query)
        const result = await paymentCollection.find(query).toArray();
        res.send(result)
      })
      
      


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Summer camp is sitting')
})

app.listen(port, () => {
  console.log(`Summer-camp is sitting on port ${port}`)
})
