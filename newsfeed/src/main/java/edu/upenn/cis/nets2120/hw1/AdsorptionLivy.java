package edu.upenn.cis.nets2120.hw1;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.concurrent.ExecutionException;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;


public class AdsorptionLivy {
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		
		LivyClient client = new LivyClientBuilder()
				// replace with appropriate URI
				.setURI(new URI("http://ec2-3-86-188-178.compute-1.amazonaws.com:8998/"))
				.build();

		try {
			String jar = "target/nets2120-hw1-0.0.1-SNAPSHOT.jar";
			System.out.printf("Uploading %s to the Spark context...\n", jar);
			client.uploadJar(new File(jar)).get(); 
			
			System.out.println("Submitting AdsorptionJob");
			client.submit(new AdsorptionJob()).get();
		} finally {
			client.stop(true);
		}
	}

}
