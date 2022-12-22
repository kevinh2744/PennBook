package edu.upenn.cis.nets2120.hw1;

import java.io.IOException;
import java.util.*;

import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.amazonaws.thirdparty.joda.time.LocalDateTime;
import com.google.gson.*;

import edu.upenn.cis.nets2120.storage.DynamoConnector;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;

import java.text.ParseException;
import java.text.SimpleDateFormat;

public class AdsorptionJob implements Job<List<Integer>> {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;
	
	DynamoDB db;
	
	private static double dMax = 0.2;
	private static double iMax = 15;

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark and DynamoDB...");
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		System.out.println("Connected!");
	}
	
	/**
	 * Builds the graph by returning a node and edge RDD
	 * 
	 * @throws ParseException parsing the date
	 */
	public void adsorption() throws ParseException {
		/****************************************************************
		 * LOADING AND SCANNING THE TABLES
		 ****************************************************************/
		
		Table articles = db.getTable("articles");
		Table interests = db.getTable("user_interests");
		Table friends = db.getTable("friends");
		Table likes = db.getTable("likes");
		
		ItemCollection<ScanOutcome> articleItems = articles.scan();
		ItemCollection<ScanOutcome> interestItems = interests.scan();
		ItemCollection<ScanOutcome> friendItems = friends.scan();
		ItemCollection<ScanOutcome> likeItems = likes.scan();
		
		System.out.println("tables loaded and scanned");
		
		/****************************************************************
		 * CREATING RDDS FROM TABLE ITEMS
		 ****************************************************************/
		
		// (a, c) and (c, a) edges
		// also generating RDD containing today's articles for later use
		List<Tuple2<String, String>> artToCat = new ArrayList<>();
		List<Tuple2<String, String>> catToArt = new ArrayList<>();
		List<Tuple2<String, String>> curArticles = new ArrayList<>();
		Iterator<Item> iter = articleItems.iterator();
		SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");
		Date today = dateFormat.parse(dateFormat.format(new Date()));
		while (iter.hasNext()) {
			Item item = iter.next();
			if (item.getString("date") == null) {
				continue;
			}
			// only want to create edges for articles that are equal or before today's date
			Date articleDate = dateFormat.parse(item.getString("date"));
			if (articleDate.compareTo(today) <= 0) {
				String url = item.getString("url");
				String category = item.getString("category");
				artToCat.add(new Tuple2<String, String>(url, category));
				catToArt.add(new Tuple2<String, String>(category, url));
				
				// specifically today's articles
				if (articleDate.compareTo(today) == 0) {
					curArticles.add(new Tuple2<String, String>(url, dateFormat.format(today)));
				}
			}
		}
		JavaRDD<Tuple2<String, String>> artToCatTempRDD = context.parallelize(artToCat);
		JavaPairRDD<String, String> artToCatRDD = artToCatTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		JavaRDD<Tuple2<String, String>> catToArtTempRDD = context.parallelize(catToArt);
		JavaPairRDD<String, String> catToArtRDD = catToArtTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		JavaRDD<Tuple2<String, String>> todaysArticlesTempRDD = context.parallelize(curArticles);
		JavaPairRDD<String, String> todaysArticles = todaysArticlesTempRDD .mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		System.out.println("# of todays articles: " + todaysArticles.count());
		
		// (u, c) and (c, u) edges
		List<Tuple2<String, String>> userToCat = new ArrayList<>();
		List<Tuple2<String, String>> catToUser = new ArrayList<>();
		iter = interestItems.iterator();
		while (iter.hasNext()) {
			Item item = iter.next();
			String user = item.getString("username");
			String category = item.getString("category");
			userToCat.add(new Tuple2<String, String>(user, category));
			catToUser.add(new Tuple2<String, String>(category, user));
		}
		JavaRDD<Tuple2<String, String>> userToCatTempRDD = context.parallelize(userToCat);
		JavaPairRDD<String, String> userToCatRDD = userToCatTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		JavaRDD<Tuple2<String, String>> catToUserTempRDD = context.parallelize(catToUser);
		JavaPairRDD<String, String> catToUserRDD = catToUserTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		
		
		// add the (u1, u2) and (u2, u1) edges
		List<Tuple2<String, String>> userToUser = new ArrayList<>();
		iter = friendItems.iterator();
		while (iter.hasNext()) {
			Item item = iter.next();
			String user = item.getString("username");
			String friend = item.getString("friend");
			userToUser.add(new Tuple2<String, String>(user, friend));
		}
		JavaRDD<Tuple2<String, String>> userToUserTempRDD = context.parallelize(userToUser);
		JavaPairRDD<String, String> userToUserRDD = userToUserTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		
		
		// (u, a) and (a, u) edges
		List<Tuple2<String, String>> userToArt = new ArrayList<>();
		List<Tuple2<String, String>> artToUser = new ArrayList<>();
		iter = likeItems.iterator();
		while (iter.hasNext()) {
			Item item = iter.next();
			String user = item.getString("username");
			String url = item.getString("url");
			userToArt.add(new Tuple2<String, String>(user, url));
			artToUser.add(new Tuple2<String, String>(url, user));
		}
		JavaRDD<Tuple2<String, String>> userToArtTempRDD = context.parallelize(userToArt);
		JavaPairRDD<String, String> userToArtRDD = userToArtTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		JavaRDD<Tuple2<String, String>> artToUserTempRDD = context.parallelize(artToUser);
		JavaPairRDD<String, String> artToUserRDD = artToUserTempRDD.mapToPair(x -> new Tuple2<String, String>(x._1, x._2));
		
		/****************************************************************
		 * GENERATING WEIGHTED EDGES
		 ****************************************************************/
		
		// RDD structure: (from_node, (to_node, weight))
		JavaPairRDD<String, Tuple2<String, Double>> catToArtEdges = catToArtRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(catToArtRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.5 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> artToCatEdges = artToCatRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(artToCatRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.5 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> userToCatEdges = userToCatRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(userToCatRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.3 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> catToUserEdges = catToUserRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(catToUserRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.5 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> userToUserEdges = userToUserRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(userToUserRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.3 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> userToArtEdges = userToArtRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(userToArtRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.4 / x._2._1)));
		
		JavaPairRDD<String, Tuple2<String, Double>> artToUserEdges = artToUserRDD.mapToPair(x -> new Tuple2<String, Double>(x._1, 1.0))
				.reduceByKey((a, b) -> a + b)
				.join(artToUserRDD)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._2._2, 0.5 / x._2._1)));
		
		
		// (from_node, (to_node, weight))
		JavaPairRDD<String, Tuple2<String, Double>> edges = catToArtEdges
				.union(artToCatEdges)
				.union(userToCatEdges)
				.union(catToUserEdges)
				.union(userToUserEdges)
				.union(userToArtEdges)
				.union(artToUserEdges);
		
		/****************************************************************
		 * ADSORPTION ALGORITHM
		 ****************************************************************/
		
		// initialize all user labels to 1
		// (node, (label, value))
		JavaPairRDD<String, Tuple2<String, Double>> nodeLabels = userToCatRDD
				.reduceByKey((a, b) -> a)
				.mapToPair(x -> new Tuple2<String, Tuple2<String, Double>>(x._1, new Tuple2<String, Double>(x._1, 1.0))); 
		
		int i = 0;
		Adsorption:
		while (i++ < iMax) {
			System.out.println("iteration " + i);
			System.out.println("nodeLabels size: " + nodeLabels.count());
			JavaPairRDD<String, Tuple2<String, Double>> newLabels = edges
					.join(nodeLabels)
					// (to_node, label), value * weight)
					.mapToPair(x -> new Tuple2<>(new Tuple2<>(x._2._1._1, x._2._2._1), x._2._2._2 * x._2._1._2))
					.reduceByKey((v1,v2) -> v1 + v2)
					// (to_node, (label, value))
					// value for each user's own label is set to 1
					.mapToPair(x -> new Tuple2<>(x._1._1, new Tuple2<>(x._1._2, (x._1._1.equals(x._1._2)) ? 1 : x._2)));
			
			// normalization step: sum of labels for each user across all nodes should equal 1
			
			// getting the sum of all labels by user
			JavaPairRDD<String, Double> labelSums = newLabels
					// (label, sum)
					.mapToPair(x -> new Tuple2<>(x._2._1, x._2._2))
					.reduceByKey((v1, v2) -> v1 + v2);
			
			// calculating normalized values
			JavaPairRDD<String, Tuple2<String, Double>> normalizedLabels = newLabels
					// (label, (node, value))
					.mapToPair(x -> new Tuple2<>(x._2._1, new Tuple2<>(x._1, x._2._2)))
					.join(labelSums)
					// (node, (label, value / sum))
					.mapToPair(x -> new Tuple2<>(x._2._1._1, new Tuple2<>(x._1, x._2._1._2 / x._2._2)));
			
			// checking for convergence
			// ((node, label), value)
			JavaPairRDD<Tuple2<String, String>, Double> oldLabelValues = nodeLabels
				.mapToPair(x -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(x._1, x._2._1), x._2._2)); 
			JavaPairRDD<Tuple2<String, String>, Double> newLabelValues = normalizedLabels
					.mapToPair(x -> new Tuple2<Tuple2<String, String>, Double>(new Tuple2<String, String>(x._1, x._2._1), x._2._2)); 
			// ((node, label), difference)
			JavaPairRDD<Tuple2<String, String>, Double> labelDifferences = newLabelValues
					.join(oldLabelValues)
					.mapToPair(x -> new Tuple2<>(new Tuple2<>(x._1._1, x._1._2), Math.abs(x._2._1 - x._2._1)));
			if (i > 2 && labelDifferences.filter(x -> x._2 >= dMax).count() == 0) {
				break Adsorption;
			}
			
			nodeLabels = normalizedLabels;
		}
		
		System.out.println("adsorption complete");
		
		/****************************************************************
		 * UPDATING TABLES
		 ****************************************************************/
		
		// filtering to get only article labels
		// (article, (label, weight))
		JavaPairRDD<String, Tuple2<String, Double>> articleLabels = nodeLabels.filter(x -> x._1.startsWith("https"));
		// updating article weights for our news search
		System.out.println("articleLabels size: " + articleLabels.count());
//		articleLabels.foreachPartition(iterator -> {
//			DynamoDB dbtemp = DynamoConnector.getConnection(Config.DYNAMODB_URL);
//			Table articleWeights = dbtemp.getTable("article_weights");
//			while(iterator.hasNext()) {
//				Tuple2<String, Tuple2<String, Double>> cur = iterator.next();
//				String url = cur._1;
//				String username = cur._2._1;
//				Double weight = cur._2._2;
//				Item item = new Item()
//						.withPrimaryKey("username", username)
//						.withString("url", url)
//						.withNumber("weight", weight);
//				articleWeights.putItem(item);
//			}
//		});
//		
//		System.out.println("successfully updated article weights");
		
		// getting articles that have already been recommended
		Table recommendations = db.getTable("recommendations");
		ItemCollection<ScanOutcome> recommendationItems = recommendations.scan();
		List<Tuple2<Tuple2<String, String>, String>> previousRecommendations= new ArrayList<>();
		iter = recommendationItems.iterator();
		while (iter.hasNext()) {
			Item item = iter.next();
			Date articleDate = dateFormat.parse(item.getString("date"));
			if (articleDate.equals(today)) {
				String username = item.getString("username");
				String url = item.getString("url");
				previousRecommendations.add(new Tuple2<>(new Tuple2<>(username, url), dateFormat.format(articleDate)));
			}
		}
		// ((username, url), date)
		JavaPairRDD<Tuple2<String, String>, String> alreadyRecommended = context.parallelize(previousRecommendations)
				.mapToPair(x -> new Tuple2<>(new Tuple2<>(x._1._1, x._1._2), x._2));
		
		// only want articles from today that have not yet been recommended
		JavaPairRDD<Tuple2<String, String>, Double> newRecommendations = articleLabels
		.join(todaysArticles)
		// ((username, url), weight)
		.mapToPair(x -> new Tuple2<>(new Tuple2<>(x._2._1._1, x._1), x._2._1._2))
		.subtractByKey(alreadyRecommended);
		
		System.out.println("new Recommendations: " + newRecommendations.count());
		
		// use hashmaps to keep track of the articles and weights for each user from adsorption
		HashMap<String, ArrayList<String>> userToArticles = new HashMap<>();
		HashMap<String, ArrayList<Double>> userToWeights = new HashMap<>();
		for (Tuple2<Tuple2<String, String>, Double> cur : newRecommendations.collect()) {
			System.out.println(cur);
			String username = cur._1._1;
			String url = cur._1._2;
			Double weight = cur._2;
			if (!userToArticles.containsKey(username)) {
				userToArticles.put(username, new ArrayList<>());
				userToWeights.put(username, new ArrayList<>());
			} 
			userToArticles.get(username).add(url);
			userToWeights.get(username).add(weight);
		}
		System.out.println(userToArticles.size());
		System.out.println(userToWeights.size());
		// find recommendation for each user based on weights
		HashMap<String, String> userToRecommendation = new HashMap<>();
		for (String user : userToArticles.keySet()) {
			ArrayList<String> userArticles = userToArticles.get(user);
			ArrayList<Double> userWeights = userToWeights.get(user);
			Double totalWeight = 0.0;
			for (int j = 0; j < userWeights.size(); j++) {
				totalWeight += userWeights.get(j);
			}
			
			// when running weight total surpasses random index, recommend the current article
			// articles with higher weights are more likely to be chosen this way
			double randomIndex = Math.random() * totalWeight;
			double curWeight = 0.0;
			for (int j = 0; j < userArticles.size(); j++) {
				curWeight += userWeights.get(j);
				if (curWeight >= randomIndex) {
					userToRecommendation.put(user, userArticles.get(j));
					break;
				}
			}
		}
		
		System.out.println(userToRecommendation.size());
		for (Map.Entry<String, String> entry: userToRecommendation.entrySet()) {
			Item item = new Item()
					.withPrimaryKey("username", entry.getKey())
					.withString("url", entry.getValue())
					.withString("date", dateFormat.format(today));
			recommendations.putItem(item);
		}
	}
	

	/**
	 * Main functionality in the program: read and process the social network
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 * @throws ParseException parsing date
	 */
	public List<Integer> run() throws IOException, InterruptedException, ParseException {
		adsorption();
		return new ArrayList<>();
	}

	@Override
	public List<Integer> call(JobContext arg0) throws Exception {
		initialize();
		return run();
	}

}
