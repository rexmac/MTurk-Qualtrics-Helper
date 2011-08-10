<?php

namespace Rexmac\Service\Amazon;

class MTurk {

	const SERVICE_NAME = 'AWSMechanicalTurkRequester';
	const URL          = 'http://mechanicalturk.amazonaws.com/';
	const TEST_URL     = 'http://mechanicalturk.sandbox.amazonaws.com/';

	public static $TESTING = false;

	public static function createHit($options) {
		return self::_makeRequest('CreateHIT', $options);
	}

	public static function createExternalHit($options) {
		if(!isset($options['Question']) && isset($options['ExternalUrl'])) {
			$frameHeight = 400;
			if(isset($options['FrameHeight'])) {
				$frameHeight = $options['FrameHeight'];
				unset($options['FrameHeight']);
			}
			$options['Question'] = '<ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd">'
				. '<ExternalURL>'.$options['ExternalUrl'].'</ExternalURL>'
				. '<FrameHeight>'.$frameHeight.'</FrameHeight>'
				. '</ExternalQuestion>';
			unset($options['ExternalUrl']);
		}
		$response = self::createHit($options);
		if($response->HIT->Request->IsValid == 'True') {
			return array(
				'hitId'     => $response->HIT->HITId,
				'hitTypeId' => $response->HIT->HITTypeId
			);
		}
		throw new Exception('Unknown error occurred: '.$response);
	}

	private static function _createUrl($operation, $data = null) {
		if(is_array($data) && isset($data['Sandbox'])) {
			self::$TESTING = !!$data['Sandbox'];
			unset($data['Sandbox']);
		}
		$url = (self::$TESTING ? self::TEST_URL : self::URL)
			. '?Service='.urlencode(self::SERVICE_NAME)
			. '&Version='.urlencode('2008-08-02')
			. '&Operation='.urlencode($operation);

		if(is_array($data)) {
			foreach($data as $k => $v) {
				$url .= '&'.$k.'='.urlencode($v);
			}
		}
		return $url;
	}

	private static function _makeRequest($operation, $data = null) {
		$url = self::_createUrl($operation, $data);
		$xml = simplexml_load_file($url);

		if(!$xml || !($xml instanceof SimpleXMLElement)) {
			throw new Exception('Received invalid response');
		}

		if($xml->OperationRequest->Errors) {
			$error = $xml->OperationRequest->Errors->Error;
			throw new Exception($error->Message, $error->Code);
		}

		$result = $xml->{$operation.'Result'};
		if($result->Request && $result->Request->Errors) {
			$error = $result->Request->Errors->Error;
			throw new Exception($error->Message, $error->Code);
		}

		return $xml;
	}
}
