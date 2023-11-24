const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
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
    await client.connect();
      
    const database = client.db("inventory");
    const shopCollection = database.collection("shop");
    const productCollection = database.collection("product");

    // insert a shop to database
    app.post('/shop', async(req,res) =>{
        const shopItem = req.body;
        const result = await shopCollection.insertOne(shopItem)
        res.send(result)
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

    // get the product from database
    app.get('/product', async(req,res) =>{
      const email = req.query.email;
      const query = {email: email};
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


// update item
// app.get('/menu/:id', async(req,res) =>{
//   const id = req.params.id;
//   const query ={ _id: new ObjectId(id)}
//   const result = await menuCollection.findOne(query)
//   res.send(result)
// })

// app.patch('/menu/:id', async(req,res) =>{
//   const item = req.body;
//   const id = req.params.id;
//   const filter = {_id: new ObjectId(id)}
//   const updatedDoc ={
//     $set: {
//       name: item.name,
//       category: item.category,
//       price: item.recipe,
//       image: item.image
//     }
//   }
//   const result = await menuCollection.updateOne(filter,updatedDoc)
//   res.send(result)
// })


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
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})