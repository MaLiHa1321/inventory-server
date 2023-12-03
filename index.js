const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ntnzcww.mongodb.net/?retryWrites=true&w=majority`;

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
      
    const database = client.db("inventory");
    const shopCollection = database.collection("shop");
    const userCollection = database.collection("users");
    const productCollection = database.collection("product");
    const cartCollection = database.collection("cart");
    const premiumCollection = database.collection("premium");
    const paymentCollection = database.collection("payment");

        // middleware
        // const verifyToken = (req,res,next) =>{
        //   if(!req?.headers.authorization){
        //     return res.status(401).send({message: 'Forbidden access'})
        //   }
        //   const token = req.headers.authorization.split(' ')[1];
        //   jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded)=>{
        //     if(err){
        //       return res.status(401).send({message: 'Forbidden access'})
        //     }
        //     req.decoded = decoded;
        //     next()
        //   })
         
        // }
    
        // const verifyAdmin = async(req,res,next) =>{
        //   const email = req.decoded.email;
        //   const query = {email: email};
        //   const user = await userCollection.findOne(query);
        //   const isAdmin = user?.role === 'admin';
        //   if(!isAdmin){
        //     return res.status(403).send({message: 'forbidden access'})
        //   }
        //   next();
        // }

    // user collection
    app.post('/users', async(req,res) =>{
      const user = req.body;
      const query ={email: user.email};
      const existUser = await userCollection.findOne(query)
      if(existUser){
        return res.send({message: 'user already exist', insertedId: null})
      }
      const result = await userCollection.insertOne(user)
      res.send(result);
    })

    // premuim data
    app.get('/premium', async(req,res) =>{
      const result = await premiumCollection.find().toArray()
      res.send(result);
    })
    app.get('/premium/:id', async(req,res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await premiumCollection.findOne(query)
      res.send(result);
    })

    // payment intent
    app.post('/create-payment-intent', async(req,res)=>{
       const { amount, email } = req.body;
       const total = parseInt(amount * 100)
       const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: 'usd',
        payment_method_types: ['card']
       })

       let newProductLimit = 0;
       if(paymentIntent.status === 'succeeded'){
        console.log('Attempting to find user with email:', email);
        const user = await userCollection.findOne({email: email});

        console.log('User:', user);
       
        if(amount === 10){
          newProductLimit = user.productLimit + 200;

        }
        else if(amount === 20){
          newProductLimit = user.productLimit + 450;
        }
        else if(amount === 50){
          newProductLimit = user.productLimit + 1500;
        }
        else{
          return res.status(400).send({message: 'Invalid amount'});
        }
         
        await shopCollection.updateOne({email: email}, {$set: {productLimit: newProductLimit}})
  

        const admin = await userCollection.findOne({role: 'admin'});
        await userCollection.updateOne({role: 'admin'}, {$inc: {income: paymentIntent.amount / 100}});

       }
        console.log(newProductLimit)
      
     
       res.send({
        clientSecret: paymentIntent.client_secret
       })
    })


    // payment realtted api
    app.post('/payment', async(req,res) =>{
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment)
      res.send(result)
    })

    // sales-summary
    app.get('/admin-stat', async(req,res)=>{
     
     const product = await productCollection.estimatedDocumentCount()
     const sales = await productCollection.estimatedDocumentCount()
     const users = await userCollection.find({}).toArray();
     const totalIncome = users.reduce((acc, user) => acc + (user.income || 0), 0);

     res.send({
      totalIncome, product, sales
     })
    })

    // user-summary
    app.get('/user-stat', async(req,res)=>{
      const email = req.query.email;
      const query ={email: email}
      const result = await productCollection.find(query).toArray();
      const totalSale = result.reduce((acc, product) => acc + parseInt(product.sales?.$numberInt || product.sales, 10) || 0, 0);
      const totalProfit = result.reduce((acc, product) => acc + parseFloat(product.profit?.$numberInt || product.profit, 10) || 0, 0);
      const totalInvest = result.reduce((acc, product) => acc +  parseInt(product.productCost?.$numberInt || product.productCost, 10) || 0, 0);
      res.send({
        totalSale,totalProfit,totalInvest
      })

      
    })


    // 
    // app.get('/users/admin/:email',  async(req,res) =>{
    //   const email = req.params.email;
    //   if(email !== req.decoded.email){
    //     return res.status(403).send({message: 'Unauthorized access'})
    //   }
    //   const query = {email: email};
    //   const user = await userCollection.findOne(query);
    //   let admin = false;
    //   if(user){
    //     admin = user?.role === 'admin';
    //   }
    //   res.send({admin});
    // })

    app.get('/users/all', async(req,res)=>{
      const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10; // Set a default limit if not provided
    const skip = (page - 1) * limit;

    const cursor = userCollection.find().skip(skip).limit(limit);
    const result = await cursor.toArray();

    // Count total documents
    const total = await userCollection.estimatedDocumentCount();

    res.send({
      total,
      result,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
      
    //   const result = await userCollection.find().toArray()
    // res.send(result);
    })

    app.get('/users',  async(req,res) =>{
       const email = req.query.email;
       const query ={email: email}
      const result = await userCollection.find(query).toArray();
      res.send(result)
    })

  // cart collection
  app.post('/cart', async(req,res) =>{
    const cartItem = req.body;
    const existingCartItem = await cartCollection.findOne({ _id: cartItem._id });
    if(existingCartItem){
      return;
    }
    const result = await cartCollection.insertOne(cartItem);
    res.send(result)
  })

  app.get('/cart',async(req,res)=>{
    const email = req.query.email;
    const query ={email: email}
    const result = await cartCollection.find(query).toArray();
    res.send(result)
  })

    // admin role
    // app.patch('/users/admin/:id',   async(req,res) =>{
    //   const id = req.params.id;
    //   const filter ={_id: new ObjectId(id)}
    //   const updatedDoc ={
    //     $set: {
    //       role: 'admin'
    //     }
    //   }
    //   const result = await userCollection.updateOne(filter,updatedDoc)
    //   res.send(result)

    // } )



    // shop-manager role
    app.patch('/users/manager/:email', async(req,res) =>{
      const email = req.params.email;
      const filter = { email: email}
      const updatedDoc ={
        $set: {
          role: 'shop-manager',
          shopInfo: req.body,
        }
      }
      const result = await userCollection.updateOne(filter,updatedDoc)
      res.send(result)
    })

    // insert a shop to database
    app.post('/shop', async(req,res) =>{
      const userEmail = req.query.email;

  // Check if the user already has a shop
  const existingShop = await shopCollection.findOne({ email: userEmail });
  if (existingShop) {
    return res.status(403).send({ error: "User already has a shop" });
  }

  const shopItem = req.body;
  const result = await shopCollection.insertOne(shopItem);
  res.send(result);
    
    })
     app.get('/shop/all', async(req,res) =>{
      const result = await shopCollection.find().toArray();
    
     res.send(result);
      
    })

    // get the shop from a user
    app.get('/shop', async(req,res) =>{
     const email = req.query.email;
     const query = {email: email}
      const cursor = shopCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

   

    // insert product to database
    app.post('/product', async(req,res) =>{
      const productItem = req.body;
      const userEmail = req.body.email;
      const userProductLimit = 3;
      const userProductCount = await productCollection.countDocuments({email: userEmail})
      if(userProductCount < userProductLimit){
        const result = await productCollection.insertOne(productItem)
        res.send(result)
      }
      else{
        return res.status(403).send({err0r: "user Product limit exceeded"})
      }
    })
        
    // checkOut page
    app.patch('/checkOut/:id', async(req,res) =>{
      
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: { sales: 1 },
        $inc: { quantity: -1 } // Decrease quantity by 1
      };
  
      const result = await productCollection.updateOne(filter, updateDoc,{ upsert: false });
      res.send(result)
      
    })
 
    // get all product
    app.get('/product/all', async(req,res) =>{
      const result = await productCollection.find().toArray();
      res.send(result)
    })

    // get the product from database
    app.get('/product', async(req,res) =>{
      const email = req.query.email;
      const query = {
        email: email, };
      const product = await productCollection.estimatedDocumentCount()
      // console.log(product)
      const cursor = productCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    // delete cart item
app.delete('/product/:id',async(req,res) =>{
    const id =req.params.id;
    const query ={_id: new ObjectId(id)}
    const result = await productCollection.deleteOne(query);
    res.send(result)
})
    
// update a product
app.get('/product/:id', async(req,res) =>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await productCollection.findOne(query);
  res.send(result);
})

// update a product content
app.patch('/product/:id', async(req,res) =>{
  const item = req.body;
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)}
  const updatedDoc ={
    $set: {
      productName: item.productName,
      photo: item.photo,
      quantity: item.quantity,
      location: item.location,
      productCost: item.productCost,
      profit: item.profit,
      discount: item.discount,
      info: item.info
    }
   
  }
  const result = await productCollection.updateOne(filter,updatedDoc)
  res.send(result)
})

// token generate
app.post('/jwt', async(req,res) =>{
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, {expiresIn: '10h'})
  res.send({token})
})






    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})