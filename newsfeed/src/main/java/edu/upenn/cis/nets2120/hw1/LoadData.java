package edu.upenn.cis.nets2120.hw1;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

import java.util.*;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.google.gson.*;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.DynamoConnector;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

/**
 * Data loader -- connect to DynamoDB, read articles from file, store
 * and index in DynamoDB.
 */
public class LoadData {
	/**
	 * A logger is useful for writing different types of messages
	 * that can help with debugging and monitoring activity.  You create
	 * it and give it the associated class as a parameter -- so in the
	 * config file one can adjust what messages are sent for this class. 
	 */
	static Logger logger = LogManager.getLogger(LoadData.class);

	/**
	 * Connection to DynamoDB
	 */
	DynamoDB db;
	
	
	/**
	 * Handler for article entries, writes to index
	 */
	IndexArticle articleIndexer;
	
	/**
	 * Path to JSON file
	 */
	final String path;
	
	/**
	 * List of jsonObjects derived from our JSON file
	 */
	ArrayList<JsonObject> jsonObjects;
	
	/**
	 * Initialize with the default loader path
	 */
	public LoadData() {
		path = "target/News_Category_Dataset_v2.json";
		final File f = new File(path);
		
		if (!f.exists())
			throw new RuntimeException("Can't load without json file");
	}

	/**
	 * Initialize with manually specified loader path
	 * 
	 * @param path Path to News_Category_Dataset_v2.json
	 */
	public LoadData(final String path) {
		this.path = path;
		
		final File f = new File(path);
		if (!f.exists())
			throw new RuntimeException("Can't load without the json file");
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, DynamoDbException, InterruptedException {
		System.setProperty("file.encoding", "UTF-8");
		logger.info("Connecting to DynamoDB...");
		db = DynamoConnector.getConnection(Config.DYNAMODB_URL);
		logger.debug("Connected!");
		articleIndexer = new IndexArticle(db);
		
		// storing all articles into a list of JsonObjects
		jsonObjects = createJsonObjects();
	}

	/**
	 * Main functionality in the program: read, store, and index articles
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run() throws IOException, DynamoDbException, InterruptedException {
		logger.info("Running");
		loadArticles();
		logger.info("*** Finished loading articles! ***");
		invertArticles();
		logger.info("*** Finished indexing articles! ***");
	}
	
	/**
	 * Creates a list of JsonObjects from the our JSON file
	 * 
	 * @return list of JsonObjects
	 */
	public ArrayList<JsonObject> createJsonObjects() {
		ArrayList<JsonObject> jsonObjects = new ArrayList<>();
		JsonParser parser = new JsonParser();
		
		try {
			BufferedReader br = new BufferedReader(new FileReader("target/News_Category_Dataset_v2.json"));
			String nextLine;
			while((nextLine = br.readLine()) != null) {
				JsonElement jsonTree = parser.parse(nextLine);
				if (jsonTree.isJsonObject()) {
					jsonObjects.add(jsonTree.getAsJsonObject());
				}
			}
			br.close();
		} catch(Exception e) {
			e.printStackTrace();
		}
		
		return jsonObjects;
	}
	
	/**
	 * Loads articles into DynamoDB table called "articles"
	 */
	public void loadArticles() {
		// creating items from the JsonObjects and batch writing to our table
		TableWriteItems batchInput = new TableWriteItems("articles");
		ArrayList<Item> items = new ArrayList<>();
		HashSet<String> batchSet = new HashSet<>();
		for (int i = 0; i < jsonObjects.size(); i++) {
			// running into error with duplicate keys in the same batch write, use url set to address this
			Item item = createItem(jsonObjects.get(i));
			if (batchSet.add(item.getString("url"))) {
				items.add(item);
			}
			
			// we want to write when our batch size is 50, or when we reach the end of the list
			if (items.size() >= 25 || i == jsonObjects.size() - 1) {
				batchInput.withItemsToPut(items);
				BatchWriteItemOutcome outcome = db.batchWriteItem(batchInput);
				
				if (outcome.getUnprocessedItems().size() > 0) {
					Map<String, List<WriteRequest>> unprocessedItems = outcome.getUnprocessedItems();
					outcome = db.batchWriteItemUnprocessed(unprocessedItems);
				}
				
				// reset items, batchInput, and batchSet
				items = new ArrayList<>();
				batchInput = new TableWriteItems("articles");
				batchSet = new HashSet<>();
			}
		}
	}
	
	/**
	 * Creates an item from a JsonObject with the "url" as key
	 * 
	 * @param JsonObject
	 * @return DynamoDB item
	 */
	public Item createItem(JsonObject obj) {
		String itemDate = obj.get("date").getAsString();
		String itemYear = itemDate.substring(0, 4);
		String adjYear = String.valueOf(Integer.parseInt(itemYear) + 5);
		String adjDate = adjYear + itemDate.substring(4, itemDate.length());
		
		Item item = new Item()
				.withPrimaryKey("url", obj.get("link").getAsString())
				.withString("date", adjDate)
				.withString("category", obj.get("category").getAsString())
				.withString("headline", obj.get("headline").getAsString())
				.withString("authors", obj.get("authors").getAsString())
				.withString("description", obj.get("short_description").getAsString());
		
		return item;
	}
	
	/**
	 * indexes all articles
	 */
	public void invertArticles() {
		for (int i = 0; i < jsonObjects.size(); i++) {
			articleIndexer.accept(jsonObjects.get(i));
		}
	}
	
	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		DynamoConnector.shutdown();
	}

	public static void main(final String[] args) {
		final LoadData ld = new LoadData();

		try {
			ld.initialize();

			ld.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final DynamoDbException e) {
			e.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			ld.shutdown();
		}
	}
}