package edu.upenn.cis.nets2120.hw1;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.*;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.google.gson.JsonObject;

import edu.upenn.cis.nets2120.hw1.files.TedTalkParser.TalkDescriptionHandler;
import opennlp.tools.stemmer.PorterStemmer;
import opennlp.tools.stemmer.Stemmer;
import opennlp.tools.tokenize.SimpleTokenizer;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

/**
 * Callback handler for article titles.  Parses, breaks words up, and
 * puts them into DynamoDB.
 * 
 * @author zives
 *
 */
public class IndexArticle {
	static Logger logger = LogManager.getLogger(TalkDescriptionHandler.class);

  final static String tableName = "inverted_articles";
	int row = 0;
	
	SimpleTokenizer model;
	Stemmer stemmer;
	DynamoDB db;
	Table iindex;
	
	public IndexArticle(final DynamoDB db) throws DynamoDbException, InterruptedException {
		model = SimpleTokenizer.INSTANCE;
		stemmer = new PorterStemmer();
		this.db = db;
	}

	/**
	 * Called every time an article is read from the input file. Breaks title into 
	 * keywords and indexes them.
	 * 
	 * @param JsonObject
	 */
	public void accept(JsonObject obj) {
		// set to keep track of unique words in our row
		HashSet<String> wordSet = new HashSet<>();
		// get set of stop words from nlp_en_stop_words.txt
		HashSet<String> stopWords = IndexArticle.getStopWords();
		
		String headline = obj.get("headline").getAsString();
		String[] token = model.tokenize(headline);
		
		// iterate through all words in headline
		for (int j = 0; j < token.length; j++) {
			String word = token[j].toLowerCase();
			// skip word if it doesn't contain only letters, or if it's contained in our stop words set
			if (!word.matches("[a-zA-Z]+") || stopWords.contains(word)) {
				continue;
			}
			String stemmedWord = (String) stemmer.stem(word);
			wordSet.add(stemmedWord);
		}
		
		TableWriteItems batchInput = new TableWriteItems("inverted_articles");
		ArrayList<Item> items = new ArrayList<>();
		HashSet<Tuple2<String, String>> batchSet = new HashSet<>();
		int i = 0;
		for (String word : wordSet) {
			String url = obj.get("link").getAsString();
			Item item = new Item()
					.withPrimaryKey("keyword", word)
					.withString("url", obj.get("link").getAsString());
			if (batchSet.add(new Tuple2<>(word, url))) {
				items.add(item);
			}
			// we want to write when our batch size is 50, or when we reach the end of the set
			if (items.size() >= 25 || i == wordSet.size() - 1) {
				batchInput.withItemsToPut(items);
				BatchWriteItemOutcome outcome = db.batchWriteItem(batchInput);
				
				if (outcome.getUnprocessedItems().size() > 0) {
					Map<String, List<WriteRequest>> unprocessedItems = outcome.getUnprocessedItems();
					outcome = db.batchWriteItemUnprocessed(unprocessedItems);
				}
				
				// reset items, batchInput, and batchSet
				items = new ArrayList<>();
				batchInput = new TableWriteItems("inverted_articles");
				batchSet = new HashSet<>();
			}
			
			i++;
		}
	}
	
	/**
	 * Gets the set of stop words in text file
	 * 
	 * @return set of stop words
	 */
	public static HashSet<String> getStopWords() {
		HashSet<String> stopWords = new HashSet<>();
		// getting our stop words file
		File file = new File("src/main/resources/nlp_en_stop_words.txt");
		try {	
			// iterate through our txt file and add all words to our stop words set
			Scanner s = new Scanner(file);
			while(s.hasNext()) {
				stopWords.add(s.next());
			}
			s.close();
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		return stopWords;
	}
}
