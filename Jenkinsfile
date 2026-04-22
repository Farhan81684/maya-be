pipeline {
    agent any
    environment{
        DOCKER_USER = "farhanraju"
        BACKEND_IMAGE = "maya-backend"
        K8S_CRED = "k8s-config"
    }

    stages {
        stage('1st Git checkout ') {
            steps {
                git branch: 'main', credentialsId: '17', url: 'https://github.com/Farhan81684/maya-be.git'
            }
        }
        stage('2nd Build&Push Backend ') {
            steps {
                script{
                    withCredentials([string(credentialsId: 'id_for_imagepush', variable: 'dockerhubpwd')]) {
                        sh "docker login -u ${DOCKER_USER} -p ${dockerhubpwd}"
                        sh "docker build -t ${DOCKER_USER}/${BACKEND_IMAGE}:latest ."
                        sh "docker push ${DOCKER_USER}/${BACKEND_IMAGE}:latest "
                    }
                }
            }
        }
        stage('3 Deploy to Kubernates') {
            steps {
                script{
                    withKubeConfig([credentialsId: 'k8s-config']) {
                        sh 'kubectl apply -f k8s/'
                        sh 'kubectl rollout restart deployment maya-be'
                    }
                }
            }
        }
    }
}
